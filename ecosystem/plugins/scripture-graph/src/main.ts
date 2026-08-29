/** Scripture Graph — the plugin suite entry point.
 *
 * One plugin, four areas (§53): CORE (identity/sync/settings), SOCIAL
 * (highlights/notes/groups), AI (Ask pane over the user's own wallet), STUDY
 * (reader, bookmarks, trails, flashcards). Shared state lives in SGState;
 * secrets and personal data live ONLY in device-local storage (§7, §65). */
import { MarkdownView, Modal, Notice, Platform, Plugin, Setting, TFile, WorkspaceLeaf, requestUrl, type App } from "obsidian";
import { chapterIdFromTitle, chapterTitle, parseVerseId, verseDisplay, type Visibility } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, LIBRARY_PREFIX, PERSONAL_PREFIX, SGState, type SharedSettings } from "./state";
import { SGNavigatorModal } from "./study/navigator";
import { AnnotationService, NoteModal } from "./social/annotations";
import { registerReadingIntegration, resolveSelection } from "./social/readingIntegration";
import { WelcomeModal, refreshIdentity } from "./social/onboarding";
import { AiService } from "./ai/aiService";
import { ASK_VIEW, AskView } from "./ai/askView";
import { READER_VIEW, ReaderView } from "./reader/readerView";
import { StudyService } from "./study/study";
import { StudyBar, openLocalGraphFor } from "./study/studyBar";
import { SCENES, SceneManager } from "./study/scenes";
import { Menu } from "obsidian";
import { SGSettingsTab } from "./settings";
import { migrateFromAnnotate } from "./migrate";

/** Longform writing dialog — the ONLY way a keyboard appears in the study
 * flow on mobile. Appends to the page's My Notes area. */
class WriteModal extends Modal {
  constructor(app: App, private chapter: string,
    private onSave: (text: string) => Promise<void>) {
    super(app);
  }
  onOpen() {
    this.contentEl.addClass("sg-write-modal");
    this.contentEl.createEl("h3", { text: `✍️ ${this.chapter} — my notes` });
    const ta = this.contentEl.createEl("textarea", {
      attr: { placeholder: "Write your thoughts… (added under My Notes)" },
    });
    new Setting(this.contentEl)
      .addButton(b => b.setButtonText("Save").setCta().onClick(async () => {
        const text = ta.value.trim();
        this.close();
        if (text) await this.onSave(text);
      }))
      .addButton(b => b.setButtonText("Cancel").onClick(() => this.close()));
    setTimeout(() => ta.focus(), 60);
  }
  onClose() { this.contentEl.empty(); }
}

/** "0.7.0" vs "0.6.1" — plain numeric semver compare. */
export function newerVersion(remote: string, local: string): boolean {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);
  if (r.some(Number.isNaN) || l.some(Number.isNaN) || !remote) return false;
  for (let i = 0; i < 3; i++) {
    const a = r[i] ?? 0, b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export default class SGPlugin extends Plugin {
  state!: SGState;
  ai!: AiService;
  ann!: AnnotationService;
  study!: StudyService;
  studyBar!: StudyBar;
  scenes = new SceneManager();
  private origOpenLinkText: typeof this.app.workspace.openLinkText | null = null;
  private studyActionViews = new WeakSet<MarkdownView>();

  async onload() {
    this.state = new SGState(this.app, this);
    // shared, non-secret settings from data.json (synced with the vault on purpose)
    const saved = (await this.loadData()) as Partial<SharedSettings> | null;
    if (saved) this.state.applySettings(saved);
    await this.state.loadDevice();

    this.ai = new AiService(this.state);
    this.ann = new AnnotationService(this.state);
    this.study = new StudyService(this.state, this.ann);

    this.addSettingTab(new SGSettingsTab(this));

    // ---- views ------------------------------------------------------------
    this.registerView(ASK_VIEW, leaf => new AskView(leaf, this.state, this.ai, this.ann));
    this.registerView(READER_VIEW, leaf =>
      new ReaderView(leaf, this.state, this.ann, (c, v, seed) => void this.openAsk(c, v, seed)));

    // ---- OpenRouter PKCE redirect (obsidian://scripture-graph-auth?code=…) --
    this.registerObsidianProtocolHandler("scripture-graph-auth", params => {
      const code = params["code"];
      if (!code) return void new Notice("AI connection failed: no code in redirect");
      this.ai.completeConnect(code).catch(e => new Notice((e as Error).message));
    });

    // ---- the study surface: tap-to-select verses + bottom action bar -------
    const openAskFromReading = (prompt: string, anchor: string | null) => {
      const ct = this.chapterTitleFor(anchor);
      void this.openAsk(ct, anchor, prompt);
    };
    this.studyBar = new StudyBar(this.state, this.ann, this.study, openAskFromReading,
      () => this.saveSharedSettings());
    registerReadingIntegration(this, this.state, this.ann, this.studyBar, openAskFromReading);

    // ---- commands ---------------------------------------------------------
    this.addCommand({
      id: "open-ask", name: "Ask AI about this passage", icon: "sparkles",
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        const isChapter = f?.path.startsWith(CANONICAL_PREFIX) ?? false;
        void this.openAsk(isChapter ? f!.basename : null, null);
      },
    });
    this.addCommand({
      id: "open-reader", name: "Open in Scripture Graph reader", icon: "book-open",
      checkCallback: checking => {
        const f = this.app.workspace.getActiveFile();
        const ok = !!f && f.path.startsWith(CANONICAL_PREFIX);
        if (!checking && ok) void this.openReader(f!.basename);
        return ok;
      },
    });
    this.addCommand({
      id: "highlight-selection", name: "Highlight selection (quick)", icon: "highlighter",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        if (!hit) return void new Notice("Select some scripture text first");
        const vis: Visibility = this.state.settings.defaultVisibility === "local" ? "local" : "private";
        void this.ann.addHighlight(hit.verseId, "yellow", hit.verseText, hit.selected, vis, null);
        new Notice(`Highlighted ${verseDisplay(hit.verseId) ?? hit.verseId}`);
      },
    });
    this.addCommand({
      id: "note-selection", name: "Add note on selection", icon: "pencil",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        if (!hit) return void new Notice("Select some scripture text first");
        new NoteModal(this.state, verseDisplay(hit.verseId) ?? hit.verseId, text => {
          const vis: Visibility = this.state.settings.defaultVisibility === "local" ? "local" : "private";
          void this.ann.addNote(hit.verseId, text, hit.selected, vis, null);
          new Notice("Note saved");
        }).open();
      },
    });
    this.addCommand({
      id: "open-my-study", name: "Open my study page for this chapter", icon: "pencil",
      checkCallback: checking => {
        const f = this.app.workspace.getActiveFile();
        const ok = !!f && f.path.startsWith(CANONICAL_PREFIX)
          && !!chapterIdFromTitle(f.basename);
        if (!checking && ok) this.openMyStudy(f!.basename);
        return ok;
      },
    });
    this.addCommand({
      id: "open-navigator", name: "Navigate scriptures (books & chapters)", icon: "compass",
      callback: () => this.openNavigator(),
    });
    this.addRibbonIcon("compass", "Navigate scriptures", () => this.openNavigator());
    this.addCommand({
      id: "reading-scene", name: "Change reading scene", icon: "sunrise",
      callback: () => this.pickScene(),
    });
    this.addCommand({
      id: "write-my-notes", name: "Write in my notes (this chapter)", icon: "pen-line",
      checkCallback: checking => {
        const f = this.app.workspace.getActiveFile();
        let target: TFile | null = null;
        if (f?.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
          target = f;
        } else if (f?.path.startsWith(CANONICAL_PREFIX) && chapterIdFromTitle(f.basename)) {
          const dest = this.app.metadataCache.getFirstLinkpathDest(
            `${f.basename} - My Notes`, "");
          if (dest) target = dest;
        }
        if (!checking && target) void this.writeInMyNotes(target);
        return !!target;
      },
    });
    this.addCommand({
      id: "open-graph", name: "See connections graph for this page", icon: "git-fork",
      checkCallback: checking => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) {
          // My Notes pages graph their chapter; everything else graphs itself
          const title = f.basename.endsWith(" - My Notes")
            ? f.basename.slice(0, -" - My Notes".length) : f.basename;
          void openLocalGraphFor(this.state, title);
        }
        return true;
      },
    });
    this.addCommand({
      id: "bookmark", name: "Bookmark this page", icon: "bookmark",
      callback: () => void this.study.bookmarkCurrent(),
    });
    this.addCommand({
      id: "save-trail", name: "Save study trail", icon: "footprints",
      callback: () => void this.study.saveTrail(),
    });
    this.addCommand({
      id: "review-flashcards", name: "Review flashcards", icon: "layers",
      callback: () => void this.study.review(),
    });
    this.addCommand({
      id: "flashcard-from-selection", name: "Make flashcard from selection", icon: "plus-square",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        const sel = hit?.selected ?? window.getSelection()?.toString().trim() ?? "";
        if (!sel) return void new Notice("Select the text for the card back first");
        const ref = hit ? verseDisplay(hit.verseId) : null;
        void this.study.addFlashcard(ref ? `What does ${ref} say?` : "Recall this passage",
          sel, hit?.verseId ?? null);
      },
    });
    this.addCommand({
      id: "sync-now", name: "Sync now", icon: "refresh-cw",
      callback: async () => { await this.ann.syncNow(); new Notice("Synced"); },
    });
    this.addCommand({
      id: "cleanup-marks", name: "Clean up marks (duplicates & conflict copies)",
      icon: "eraser",
      callback: () => void this.cleanupMarks(),
    });
    this.addCommand({
      id: "export-my-data", name: "Export my data", icon: "download",
      callback: () => void this.exportMyData(),
    });
    this.addCommand({
      id: "join", name: "Join Scripture Graph (invite code)", icon: "user-plus",
      callback: () => new WelcomeModal(this.state, this.ai, () => { /* settings will refresh */ }).open(),
    });

    // ---- 📖 navigator: floating button + AI Library gate -------------------
    const fab = document.body.createDiv({ cls: "sg-nav-fab" });
    fab.setText("📖");
    fab.setAttr("aria-label", "Navigate scriptures");
    fab.onclick = () => this.openNavigator();
    this.register(() => fab.remove());
    document.body.toggleClass("sg-hide-ai-lib", !this.state.device.showAiLibrary);
    this.register(() => {
      document.body.removeClass("sg-hide-ai-lib");
      document.body.removeClass("sg-fab-on");
    });

    // ---- study-trail tracking + read-only enforcement ----------------------
    this.registerEvent(this.app.workspace.on("file-open", f => {
      if (!f) return;
      this.studyBar.clear();          // selections never follow you across pages
      this.study.recordVisit(f);
      this.recordLastChapter(f);
      this.updateNavFab(f);
      this.enforceReadOnly();
      void this.matchSceneToChapter(f);
      // personal pages OPEN in reading view too (mobile reuses the last tab
      // mode, so app.json's default is not enough) — but only on open: once
      // the user taps the pencil to write, we never fight them
      this.openInPreviewOnce(f);
      this.addMyStudyAction(f);
    }));
    // canonical scripture must never sit in an editable view — mobile has no
    // OS read-only bit, and the pencil toggle would otherwise re-enable edits
    this.registerEvent(this.app.workspace.on("layout-change", () => this.enforceReadOnly()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.enforceReadOnly()));

    // ---- chapter links land on the EDITABLE My Notes page (§user) ----------
    // Verse-anchored links ("Alma 36#^alma-36-18") keep opening canonical —
    // block anchors only exist there. Bare chapter links redirect to the
    // personal companion, which embeds the same scripture and is yours to edit.
    this.origOpenLinkText = this.app.workspace.openLinkText.bind(this.app.workspace);
    const orig = this.origOpenLinkText;
    this.app.workspace.openLinkText = (linktext: string, sourcePath: string,
      newLeaf?: unknown, openViewState?: unknown) => {
      const redirect = this.companionForLink(linktext, sourcePath);
      return orig(redirect ?? linktext, sourcePath, newLeaf as never,
        openViewState as never);
    };

    // ---- deferred startup --------------------------------------------------
    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        // the superseded v0.2 plugin keeps resurrecting via config sync from
        // devices that still list it — every device now retires it on sight
        const plugins = (this.app as unknown as {
          plugins?: { enabledPlugins?: Set<string>;
            disablePluginAndSave?: (id: string) => Promise<void> };
        }).plugins;
        if (plugins?.enabledPlugins?.has?.("scripture-graph-annotate")) {
          await plugins.disablePluginAndSave?.("scripture-graph-annotate");
          new Notice("Old Scripture Graph plugin retired (it kept re-enabling itself via sync)");
        }
        // always know what build you're on — the toast is the proof
        const seen = await this.state.store.get<string>("last_loaded_version");
        if (seen !== this.manifest.version) {
          await this.state.store.put("last_loaded_version", this.manifest.version);
          new Notice(`Scripture Graph v${this.manifest.version} loaded`);
        }
        if (this.state.device.debugOverlay) {
          const { setOverlay } = await import("./study/trace");
          setOverlay(true);
        }
        // ambient scene: restore + hourly re-pick when following the clock
        this.scenes.apply(this.state.device.scene ?? "none");
        this.registerInterval(window.setInterval(() => {
          if (this.state.device.scene === "auto") this.scenes.apply("auto");
        }, 15 * 60_000));
        await migrateFromAnnotate(this.state);
        this.ann.start();
        await refreshIdentity(this.state);
        if (!this.state.signedIn && !(await this.state.store.get<boolean>("welcome_shown"))) {
          await this.state.store.put("welcome_shown", true);
          new WelcomeModal(this.state, this.ai, () => { /* noop */ }).open();
        }
        // self-update from the family server (kills sync-delivery roulette)
        const last = (await this.state.store.get<number>("update_checked_at")) ?? 0;
        if (Date.now() - last > 6 * 3600_000) {
          await this.state.store.put("update_checked_at", Date.now());
          void this.checkForUpdate(true);
        }
      })();
    });
  }

  // ------------------------------------------------------------ self-update

  /** Pull the latest build from the family server's /plugin channel and
   * install it in place. `silent` = only speak when something happens. */
  async checkForUpdate(silent: boolean): Promise<void> {
    const base = this.state.settings.serverUrl.replace(/\/$/, "");
    try {
      const mf = await requestUrl({ url: `${base}/plugin/manifest.json`, throw: false });
      if (mf.status !== 200) {
        if (!silent) new Notice("No plugin build published on the server yet");
        return;
      }
      // parse from text with BOM tolerance — .json can choke on a BOM
      let manifest: { version?: string };
      try {
        manifest = JSON.parse(mf.text.replace(/^\uFEFF/, "")) as { version?: string };
      } catch {
        if (!silent) new Notice("Update channel returned an unreadable manifest");
        return;
      }
      const remote = manifest.version ?? "";
      if (!newerVersion(remote, this.manifest.version)) {
        if (!silent) new Notice(`Up to date — v${this.manifest.version}`);
        return;
      }
      const [main, styles] = await Promise.all([
        requestUrl({ url: `${base}/plugin/main.js`, throw: false }),
        requestUrl({ url: `${base}/plugin/styles.css`, throw: false }),
      ]);
      if (main.status !== 200 || main.text.length < 10_000) {
        if (!silent) new Notice("Update download failed — try again");
        return;
      }
      const dir = `${this.app.vault.configDir}/plugins/scripture-graph`;
      const ad = this.app.vault.adapter;
      await ad.write(`${dir}/main.js`, main.text);
      if (styles.status === 200) await ad.write(`${dir}/styles.css`, styles.text);
      await ad.write(`${dir}/manifest.json`, JSON.stringify(mf.json, null, 2));
      new Notice(`Scripture Graph updated to v${remote} — reloading…`, 8000);
      window.setTimeout(() => {
        const cmds = (this.app as unknown as {
          commands?: { executeCommandById?: (id: string) => void };
        }).commands;
        cmds?.executeCommandById?.("app:reload");
      }, 900);
    } catch (e) {
      if (!silent) new Notice(`Update check failed: ${(e as Error).message}`);
    }
  }

  onunload() {
    this.ann.stop();
    this.studyBar?.clear();
    if (this.origOpenLinkText) {
      this.app.workspace.openLinkText = this.origOpenLinkText;
    }
  }

  /** "<Chapter> - My Notes" when the link should land on the editable page. */
  private companionForLink(linktext: string, sourcePath: string): string | null {
    if (!this.state.settings.chapterLinksToMyStudy) return null;
    if (!linktext || linktext.includes("#")) return null;  // verse/heading links stay
    const dest = this.app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
    if (!dest || !dest.path.startsWith(CANONICAL_PREFIX)) return null;
    if (!chapterIdFromTitle(dest.basename)) return null;   // only chapter files
    // the My Study page's own "Plain text" link must still reach canonical
    const srcBase = sourcePath.split("/").pop() ?? "";
    if (srcBase === `${dest.basename} - My Notes.md`) return null;
    const companion = `${dest.basename} - My Notes`;
    return this.app.metadataCache.getFirstLinkpathDest(companion, "") ? companion : null;
  }

  private openMyStudy(chapterTitle: string): void {
    const companion = `${chapterTitle} - My Notes`;
    if (this.app.metadataCache.getFirstLinkpathDest(companion, "")) {
      void (this.origOpenLinkText ?? this.app.workspace.openLinkText)(companion, "");
    } else {
      new Notice("No My Notes page exists for this chapter yet");
    }
  }

  /** 📖 Volume → book → chapter in three taps; lands on My Study pages. */
  private openNavigator(): void {
    new SGNavigatorModal(this.app, {
      openChapter: t => this.openMyStudy(t),
      openNote: l => void (this.origOpenLinkText ?? this.app.workspace.openLinkText)(l, ""),
      lastChapter: () => this.state.device.lastChapter,
    }).open();
  }

  /** Remember where the reader is — powers the navigator's Continue card. */
  private recordLastChapter(f: TFile): void {
    let title: string | null = null;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
      title = f.basename.slice(0, -" - My Notes".length);
    } else if (f.path.startsWith(CANONICAL_PREFIX)) {
      title = f.basename;
    }
    const slug = title ? chapterIdFromTitle(title) : null;
    if (!title || !slug) return;
    const d = this.state.device;
    if (d.lastChapter?.slug === slug) return;
    d.lastChapter = { slug, title };
    void this.state.saveDevice();
  }

  /** The floating 📖 shows only while reading library/study pages. */
  private updateNavFab(f: TFile | null): void {
    const on = !!f && (f.path.startsWith(PERSONAL_PREFIX) || f.path.startsWith(LIBRARY_PREFIX));
    document.body.toggleClass("sg-fab-on", on);
  }

  /** In "match" mode the scene follows the chapter's own words.
   * A My Notes page only CONTAINS an embed reference — the scripture text
   * lives in the canonical file, so resolve to that before scoring. */
  async matchSceneToChapter(f: TFile): Promise<void> {
    if (this.state.device.scene !== "match") return;
    let target: TFile | null = null;
    if (f.path.startsWith(CANONICAL_PREFIX) && chapterIdFromTitle(f.basename)) {
      target = f;
    } else if (f.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(
        f.basename.replace(/ - My Notes$/, ""), "");
      if (dest?.path.startsWith(CANONICAL_PREFIX)) target = dest;
    }
    if (!target) return;
    try {
      const { matchScene } = await import("./study/presence");
      const slug = (this.app.metadataCache.getFileCache(target)?.frontmatter as
        { slug?: string } | undefined)?.slug;
      const text = await this.app.vault.cachedRead(target);
      this.scenes.apply(matchScene(text, slug));
    } catch { /* keep current scene */ }
  }

  /** Ambient scene picker. */
  pickScene(): void {
    const menu = new Menu();
    const set = (value: string, label: string) => {
      this.state.device.scene = value;
      void this.state.saveDevice();
      if (value === "match") {
        const f = this.app.workspace.getActiveFile();
        if (f) void this.matchSceneToChapter(f);
      } else {
        this.scenes.apply(value);
      }
      new Notice(`Reading scene: ${label}`);
    };
    menu.addItem(i => i.setTitle("✖ None (plain)").onClick(() => set("none", "none")));
    menu.addItem(i => i.setTitle("🕐 Auto — follow the time of day")
      .onClick(() => set("auto", "auto")));
    menu.addItem(i => i.setTitle("📖 Match the chapter — the scene follows the words")
      .onClick(() => set("match", "match the chapter")));
    menu.addSeparator();
    for (const s of SCENES) {
      menu.addItem(i => i.setTitle(`${s.emoji} ${s.name}`)
        .onClick(() => set(s.id, s.name)));
    }
    menu.showAtPosition({ x: window.innerWidth / 2 - 110, y: window.innerHeight / 3 });
  }

  /** ✍️ Write dialog: append to the My Notes section without ever putting
   * the page itself into an editor (mobile keyboard stays in the dialog). */
  async writeInMyNotes(f: TFile): Promise<void> {
    new WriteModal(this.app, f.basename.replace(/ - My Notes$/, ""), async (text) => {
      await this.app.vault.process(f, (c) =>
        `${c.trimEnd()}\n\n${text.trim()}\n`);
      new Notice("Added to your notes ✍️");
    }).open();
  }

  /** ✏️ + 🕸 buttons in the title bar of every canonical chapter view,
   * ✍️ on My Study pages. */
  private addMyStudyAction(f: TFile): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.path !== f.path || this.studyActionViews.has(view)) return;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
      this.studyActionViews.add(view);
      view.addAction("pen-line", "Write in my notes", () => {
        const cur = view.file;
        if (cur) void this.writeInMyNotes(cur);
      });
      return;
    }
    if (!f.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(f.basename)) return;
    this.studyActionViews.add(view);
    view.addAction("git-fork", "See this chapter's connections graph", () => {
      const cur = view.file;
      if (cur) void openLocalGraphFor(this.state, cur.basename);
    });
    view.addAction("pencil", "Open my study page (editable)", () => {
      const cur = view.file;
      if (cur) this.openMyStudy(cur.basename);
    });
  }

  // ------------------------------------------------------------------ util
  async saveSharedSettings(): Promise<void> {
    await this.saveData(this.state.settings);
  }

  private chapterTitleFor(verseId: string | null): string | null {
    if (!verseId) return null;
    const r = parseVerseId(verseId);
    return r ? chapterTitle(r.bookSlug, r.chapter) : null;
  }

  /** Personal Library pages open reading-first; the pencil toggle switches to
   * writing and sticks until the next open. Mobile restores a tab's editing
   * mode slightly AFTER file-open fires, so the flip retries briefly. */
  private openInPreviewOnce(f: TFile): void {
    if (!f.path.startsWith(PERSONAL_PREFIX)) return;
    const flip = () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || view.file?.path !== f.path) return;
      if (view.getMode() === "preview") return;
      void view.leaf.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" },
      });
    };
    flip();
    window.setTimeout(flip, 150);
    window.setTimeout(flip, 500);
  }

  /** Scripture is a study surface, not an editor. Canonical files are ALWAYS
   * flipped back to reading view (even if the user hits the pencil toggle —
   * phones have no OS read-only bit); the rest of the AI Library follows the
   * forceLibraryPreview setting. Personal Library/ files are never touched. */
  private noticedReadOnly = new Set<string>();

  private enforceReadOnly(): void {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || !view.file) continue;
      const path = view.file.path;
      const canonical = path.startsWith(CANONICAL_PREFIX);
      const aiLibrary = path.startsWith(LIBRARY_PREFIX);
      // phones: My Study pages are a READING surface too — the keyboard only
      // ever appears through the ✍️ write dialog (user-reported keyboard trap)
      const mobileStudyPage = Platform.isMobile
        && path.startsWith(PERSONAL_PREFIX) && path.endsWith(" - My Notes.md");
      if (!canonical && !mobileStudyPage
        && !(aiLibrary && this.state.settings.forceLibraryPreview)) continue;
      if (view.getMode() === "preview") continue;
      void leaf.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" },
      });
      if (canonical && !this.noticedReadOnly.has(path)) {
        this.noticedReadOnly.add(path);
        new Notice("Scripture is read-only — highlight it, or write in ✏️ My Notes");
      }
    }
  }

  async openAsk(chapterTitle: string | null, verseId: string | null, seed?: string): Promise<void> {
    const leaf = await this.ensureLeaf(ASK_VIEW, "right");
    if (!leaf) return;
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof AskView) view.setAnchor(chapterTitle, verseId, seed);
  }

  async openReader(title: string): Promise<void> {
    const leaf = await this.ensureLeaf(READER_VIEW, "tab");
    if (!leaf) return;
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof ReaderView) await view.setChapter(title);
  }

  private async ensureLeaf(type: string, where: "right" | "tab"): Promise<WorkspaceLeaf | null> {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    if (existing) return existing;
    const leaf = where === "right"
      ? this.app.workspace.getRightLeaf(false)
      : this.app.workspace.getLeaf("tab");
    if (leaf) await leaf.setViewState({ type, active: true });
    return leaf;
  }

  /** §49 data portability: everything of mine → Library/Exports (Markdown + JSON). */
  async exportMyData(): Promise<void> {
    const folder = `${PERSONAL_PREFIX}Exports`;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const stamp = new Date().toISOString().slice(0, 10);

    // device-local + synced annotations known to this device
    const local = await this.state.sync.allAnnotations();
    // server copy (account-private + group + public of mine), when reachable
    let server: unknown = null;
    if (this.state.signedIn) {
      try { server = await this.state.api.exportMyData(); } catch { /* offline */ }
    }

    const json = JSON.stringify({
      exported_at: new Date().toISOString(),
      device_annotations: local,
      server_export: server,
    }, null, 2);
    await this.writeExport(`${folder}/scripture-graph-export-${stamp}.json`, json);

    const lines: string[] = [
      "---", "ownership: personal", "mutable: user", "content_type: export", "---", "",
      `# My Scripture Graph data — ${stamp}`, "",
    ];
    const byAnchor = new Map<string, typeof local>();
    for (const a of local.filter(x => !x.deleted_at)) {
      const arr = byAnchor.get(a.anchor_id) ?? [];
      arr.push(a);
      byAnchor.set(a.anchor_id, arr);
    }
    for (const [anchor, list] of [...byAnchor.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      lines.push(`## ${verseDisplay(anchor) ?? anchor}`, "");
      for (const a of list) {
        const vis = a.visibility === "local" ? "device-only" : a.visibility;
        if (a.annotation_type === "highlight") {
          lines.push(`- 🖍 ${a.color ?? "yellow"} highlight (${vis})${a.selected_text ? `: "${a.selected_text}"` : ""}`);
        } else if (a.content) {
          lines.push(`- 📝 (${vis}) ${a.content.replace(/\n/g, " ")}`);
        }
      }
      lines.push("");
    }
    await this.writeExport(`${folder}/My annotations ${stamp}.md`, lines.join("\n"));
    new Notice("Exported to Library/Exports");
  }

  /** One sweep over my annotations: duplicate flashcards, duplicate
   * highlights, and "⚠ Conflict copy" junk notes get soft-deleted (oldest
   * copy of each real thing is kept). */
  async cleanupMarks(): Promise<void> {
    const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
    const all = (await this.state.sync.allAnnotations())
      .filter(a => a.author_user_id === this.state.device.userId || a.author_user_id === null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const seen = new Set<string>();
    let removed = 0;
    for (const a of all) {
      if (a.annotation_type === "note" && a.content.startsWith("⚠ Conflict copy")) {
        await this.state.sync.softDelete(a.annotation_id);
        removed++;
        continue;
      }
      let key: string | null = null;
      if (a.annotation_type === "study-marker") {
        try {
          const d = JSON.parse(a.content) as { back?: string };
          key = `card|${a.anchor_id}|${norm(d.back ?? "")}`;
        } catch { key = null; }
      } else if (a.annotation_type === "highlight") {
        key = `hl|${a.anchor_id}|${a.color ?? ""}|${norm(a.selected_text ?? "")}`;
      } else if (a.annotation_type === "bookmark") {
        key = `bm|${a.anchor_id}`;
      }
      if (!key) continue;
      if (seen.has(key)) {
        await this.state.sync.softDelete(a.annotation_id);
        removed++;
      } else {
        seen.add(key);
      }
    }
    this.ann.scheduleSync(500);
    this.state.rerenderReading();
    new Notice(removed
      ? `Cleaned up ${removed} duplicate/junk mark${removed === 1 ? "" : "s"} 🧹`
      : "Nothing to clean — your marks are tidy ✨");
  }

  private async writeExport(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }
}
