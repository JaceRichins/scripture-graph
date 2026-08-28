/** Scripture Graph — the plugin suite entry point.
 *
 * One plugin, four areas (§53): CORE (identity/sync/settings), SOCIAL
 * (highlights/notes/groups), AI (Ask pane over the user's own wallet), STUDY
 * (reader, bookmarks, trails, flashcards). Shared state lives in SGState;
 * secrets and personal data live ONLY in device-local storage (§7, §65). */
import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { chapterIdFromTitle, chapterTitle, parseVerseId, verseDisplay, type Visibility } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, LIBRARY_PREFIX, PERSONAL_PREFIX, SGState, type SharedSettings } from "./state";
import { AnnotationService, NoteModal } from "./social/annotations";
import { registerReadingIntegration, resolveSelection } from "./social/readingIntegration";
import { WelcomeModal, refreshIdentity } from "./social/onboarding";
import { AiService } from "./ai/aiService";
import { ASK_VIEW, AskView } from "./ai/askView";
import { READER_VIEW, ReaderView } from "./reader/readerView";
import { StudyService } from "./study/study";
import { SGSettingsTab } from "./settings";
import { migrateFromAnnotate } from "./migrate";

export default class SGPlugin extends Plugin {
  state!: SGState;
  ai!: AiService;
  ann!: AnnotationService;
  study!: StudyService;
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

    // ---- in-place reading decorations + selection menu ---------------------
    registerReadingIntegration(this, this.state, this.ann, (prompt, anchor) => {
      const ct = this.chapterTitleFor(anchor);
      void this.openAsk(ct, anchor, prompt);
    });

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
      id: "export-my-data", name: "Export my data", icon: "download",
      callback: () => void this.exportMyData(),
    });
    this.addCommand({
      id: "join", name: "Join Scripture Graph (invite code)", icon: "user-plus",
      callback: () => new WelcomeModal(this.state, this.ai, () => { /* settings will refresh */ }).open(),
    });

    // ---- study-trail tracking + AI Library stays read-only-looking ---------
    this.registerEvent(this.app.workspace.on("file-open", f => {
      if (!f) return;
      this.study.recordVisit(f);
      if (this.state.settings.forceLibraryPreview) this.forcePreview(f);
      this.addMyStudyAction(f);
    }));

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
        await migrateFromAnnotate(this.state);
        this.ann.start();
        await refreshIdentity(this.state);
        if (!this.state.signedIn && !(await this.state.store.get<boolean>("welcome_shown"))) {
          await this.state.store.put("welcome_shown", true);
          new WelcomeModal(this.state, this.ai, () => { /* noop */ }).open();
        }
      })();
    });
  }

  onunload() {
    this.ann.stop();
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

  /** ✏️ button in the title bar of every canonical chapter view. */
  private addMyStudyAction(f: TFile): void {
    if (!f.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(f.basename)) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.path !== f.path || this.studyActionViews.has(view)) return;
    this.studyActionViews.add(view);
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

  /** AI Library pages open in reading view — nobody edits engine/canonical
   * content by accident (complements the OS read-only bit on Canonical). */
  private forcePreview(f: TFile): void {
    if (!f.path.startsWith(LIBRARY_PREFIX)) return;
    const leaf = this.app.workspace.getMostRecentLeaf();
    const view = leaf?.view;
    if (view instanceof MarkdownView && view.file?.path === f.path && view.getMode() !== "preview") {
      void leaf!.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" },
      });
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

  private async writeExport(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }
}
