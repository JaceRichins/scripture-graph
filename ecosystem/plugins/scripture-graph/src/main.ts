/** Scripture Graph — the plugin suite entry point.
 *
 * One plugin, four areas (§53): CORE (identity/sync/settings), SOCIAL
 * (highlights/notes/groups), AI (Ask pane over the user's own wallet), STUDY
 * (reader, bookmarks, trails, flashcards). Shared state lives in SGState;
 * secrets and personal data live ONLY in device-local storage (§7, §65). */
import { MarkdownView, Modal, Notice, Platform, Plugin, Setting, TFile, TFolder, WorkspaceLeaf, requestUrl, type App, type ItemView } from "obsidian";
import { ensureEnochStudy, registerEnochStudy } from './study/enochStudy';
import { openChapterStudy } from './study/chapterStudy';
import { registerAtlas } from './study/atlas/register';
import { chapterIdFromTitle, chapterTitle, parseVerseId, verseDisplay, type Visibility } from "@scripture-graph/core-sdk";
import { ANNOTATED_PREFIX, CANONICAL_PREFIX, LIBRARY_PREFIX, PERSONAL_PREFIX, SGState, type SharedSettings } from "./state";
import { type NavigatorHost } from "./study/navigator";
import { recordHistory } from "./study/leafNav";
import { LIBRARY_VIEW, SGLibraryView } from "./study/libraryView";
import { LibraryPreviewModal, sheetTargetFor } from "./study/libraryPreview";
import { VersePeekModal, peekTargetFor } from "./study/versePeek";
import { closeAllSheets } from "./study/sheetRegistry";
import { readingChapterTitle, registerSwipeNav } from "./study/swipeNav";
import { registerSidebarSwipeGuard } from './study/sidebarSwipeGuard';
import { closeMobileSidebars, registerSidebarNavigation } from './study/sidebarNavigation';
import { registerKeyboardNav } from "./study/keyboardNav";
import { registerPhotoShortcuts } from "./study/photoShortcuts";
import { applyDefaultAppearance } from './study/defaultAppearance';
import { registerKeyboardWatch } from "./study/keyboardWatch";
import { TIMELINE_VIEW, TimelineView, openTimelinePicker, type TimelinePreset } from "./study/timelineView";
import type { Subject } from './study/timelineSubjects';
import { AnnotationService, NoteModal } from "./social/annotations";
import { registerReadingIntegration, resolveSelection } from "./social/readingIntegration";
import { WelcomeModal, WELCOME_SNOOZE_KEY, refreshIdentity } from "./social/onboarding";
import { FamilyConnectModal } from './social/familyConnect';
import { AiService } from "./ai/aiService";
import { ASK_VIEW, AskView } from "./ai/askView";
import { projectDocument } from "./ai/pageContext";
import { lessonRoot, lessonProject } from './ai/lessonProject';
import { rememberReadingPosition } from './study/readingPosition';
import { BookmarkReading } from './study/bookmarkReading';
import { BookmarkControls } from './study/bookmarkControls';
import { BookmarkSheet, BookmarksModal } from './study/bookmarkViews';
import { SceneCache, wideScene } from './study/sceneCache';
import { SceneStorageModal } from './study/sceneStorage';
import type { AskHost } from "./ai/actions";
import { READER_VIEW, ReaderView } from "./reader/readerView";
import { DOC_VIEW, DocView, docKindFor } from "./reader/docView";
import { SHARED_LESSON_VIEW, SHARED_PROJECT_VIEW, SharedLessonView, SharedProjectView, ShareLessonModal, isLesson } from './social/sharedLessons';
import { findTalkVideo, pageTitle, youtubeIdOf } from "./study/youtubeFind";
import { Dock, isPhone, obsidianInternals } from "./study/dock";
import { ReadingSettingsModal, applyReading, readingPrefs, readingSnapshot, saveReading } from "./study/readingSettings";
import { VaultSync, setLazyFetch } from "./sync/vaultSync";
import { fetchMissingEmbeds } from './sync/embeddedAssets';
import { FamilyNarrator, NARRATION_INDEX } from './study/familyNarration';
import { addSendPageItem, FamilyInboxModal } from './social/pageSharing';
import { runSetupLink, SETUP_RESUME_KEY } from "./social/setupLink";
import { LiveLink } from "./live";
import { MusicPlayer, type PlayItem } from "./study/music";
import { Spotify } from "./study/spotify";
import { StudyService } from "./study/study";
import { StudyBar, openLocalGraphFor } from "./study/studyBar";
import { SCENES, SceneManager, configuredSceneId } from "./study/scenes";
import { Menu } from "obsidian";
import { addPrintItems, addLessonPrintItem } from './printing/printMenu';
import { SGSettingsTab } from "./settings";
import { migrateFromAnnotate } from "./migrate";
import { BANNER_RE, BUILD } from "./build";
import { applyBackgroundVisibility } from './study/backgroundVisibility';
import { supplementalChapterNumber, isSupplementalPage } from './study/supplementalScriptures';
import { commandmentsChapterNumber } from './study/commandments';
import { ensureCommandmentsStudy, registerCommandmentsStudy } from './study/commandmentsStudy';
import { newestRelease, newerVersion } from './sync/updateChannel';
export { newerVersion } from './sync/updateChannel';
import { trace } from "./study/trace";

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

export default class SGPlugin extends Plugin {
  state!: SGState;
  ai!: AiService;
  ann!: AnnotationService;
  study!: StudyService;
  private bookmarkReading!: BookmarkReading;
  private bookmarkControls!: BookmarkControls;
  studyBar!: StudyBar;
  scenes = new SceneManager();
  private origOpenLinkText: typeof this.app.workspace.openLinkText | null = null;
  private studyActionViews = new WeakSet<MarkdownView>();
  private lastReadingPath: string | null = null;
  private backPillEl: HTMLElement | null = null;
  private bouncing = false;

  async onload() {
    this.state = new SGState(this.app, this);
    // shared, non-secret settings from data.json (synced with the vault on purpose)
    const saved = (await this.loadData()) as Partial<SharedSettings> | null;
    if (saved) this.state.applySettings(saved);
    await this.state.loadDevice();
    await refreshIdentity(this.state);
    try { await applyDefaultAppearance(this.state); }
    catch { new Notice('Could not save the new appearance defaults. They will retry when Obsidian opens again.'); }
    this.scenes.cache = new SceneCache(this.app.vault.adapter, `${this.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.manifest.id}`}/scene-cache`, () => this.state.device.sceneCacheMB ?? 100);
    this.applyConfiguredScene(); // show bundled art before deferred sync/startup
    const choosePhoto = (id: string) => {
      this.state.device.scene = id;
      this.scenes.apply(id);
      void this.state.saveDevice();
    };
    registerPhotoShortcuts(this,
      () => { if (!this.scenes.current()) choosePhoto("study"); },
      () => {
        const current = SCENES.findIndex(scene => scene.id === this.scenes.current());
        choosePhoto(SCENES[(current + 1) % SCENES.length]!.id);
      });
    let sceneWide=wideScene(window.innerWidth,window.innerHeight);
    this.registerDomEvent(window,'online',()=>this.scenes.refresh());
    this.registerDomEvent(window,'resize',()=>{const wide=wideScene(window.innerWidth,window.innerHeight);if(wide!==sceneWide){sceneWide=wide;this.scenes.refresh();}});

    this.ai = new AiService(this.state);
    this.ann = new AnnotationService(this.state);
    this.study = new StudyService(this.state, this.ann);
    this.bookmarkReading = new BookmarkReading(this.state, this.study);
    this.bookmarkControls = new BookmarkControls({
      current: () => this.currentBookmarkPage(),
      lookup: file => this.study.bookmarkOf(file),
      add: file => this.study.bookmarkFile(file),
      open: mark => new BookmarkSheet(this.app, this.study, mark, () => this.openBookmarkList()).open(),
      error: () => { new Notice('Could not change the bookmark. Please try again.'); },
    });
    this.study.bookmarksChanged = async () => { await this.bookmarkReading.refresh(); await this.bookmarkControls.refresh(); };
    this.ann.afterSync = () => this.study.maintainBookmarks();
    const refreshBookmarkControls = () => { void this.bookmarkControls.refresh(); };
    this.state.onChange.push(refreshBookmarkControls);
    this.register(() => { const i = this.state.onChange.indexOf(refreshBookmarkControls); if (i >= 0) this.state.onChange.splice(i, 1); this.bookmarkControls.dispose(); });
    const trackBookmarks = () => { this.bookmarkReading.scan(); refreshBookmarkControls(); };
    this.registerEvent(this.app.workspace.on('layout-change', trackBookmarks));
    this.registerEvent(this.app.workspace.on('active-leaf-change', trackBookmarks));
    this.registerEvent(this.app.workspace.on('file-open', trackBookmarks));
    this.app.workspace.onLayoutReady(trackBookmarks);
    this.registerDomEvent(document, 'visibilitychange', () => this.bookmarkReading.flush());
    this.registerDomEvent(window, 'pagehide', () => this.bookmarkReading.flush());
    this.register(() => this.bookmarkReading.dispose());

    this.addSettingTab(new SGSettingsTab(this));

    // ---- views ------------------------------------------------------------
    this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (file instanceof TFile && isLesson(file.path)) menu.addItem(item => item.setTitle('Share lesson progress').setIcon('share').onClick(() => new ShareLessonModal(this.state, file).open()));
      if (file instanceof TFile) addPrintItems(menu, this.app, file);
      else addLessonPrintItem(menu, this.app, file.path);
      if (file instanceof TFile) addSendPageItem(menu, this.state, file);
    }));
    this.addCommand({ id: 'family-inbox', name: 'Open family inbox', callback: () => {
      new FamilyInboxModal(this.state, async path => {
        if (!(await this.ensureLocal(path))) throw Error('Page unavailable');
        await this.app.workspace.openLinkText(path, '');
      }).open();
    } });
    this.registerView(ASK_VIEW, leaf => new AskView(leaf, this.state, this.ai, this.ann, this.askHost()));
    this.registerPageView(SHARED_LESSON_VIEW, leaf => new SharedLessonView(leaf, this.state, () => this.openLibraryShelf(v => v.showMyWork())));
    this.registerPageView(SHARED_PROJECT_VIEW, leaf => new SharedProjectView(leaf, this.state, () => this.openLibraryShelf(v => v.showMyWork())));
    // hard questions and talks are pages of their own (reader/docView.ts)
    this.registerPageView(DOC_VIEW, leaf => new DocView(leaf, this.state, this.ann, {
      openAsk: (seed) => void this.openAsk(null, null, `About "${seed}" — `),
      openReading: () => this.openReadingSettings(),
      bookmark: (f) => this.study.bookmarkFile(f),
      bookmarkId: async (f) => (await this.study.bookmarkOf(f))?.annotation_id ?? null,
      unbookmark: async (id) => {
        const a = (await this.state.sync.allAnnotations()).find(x => x.annotation_id === id);
        if (a) await this.study.unbookmark(a);
      },
      openLibrary: () => this.openNavigator(),
      openLessonHome: (folder, resources) => this.openLibraryShelf(v => v.showLesson(folder, { resources })),
      openMyWork: () => this.openLibraryShelf(v => v.showMyWork()),
      playVideo: (id, title, sub) => this.music.playVideo(id, title, sub),
      openRaw: this.state.device.showAiLibrary
        ? (f) => { void this.app.workspace.getLeaf().openFile(f); } : null,
    }));
    this.registerPageView(READER_VIEW, leaf =>
      new ReaderView(leaf, this.state, this.ann, (c, v, seed) => void this.openAsk(c, v, seed)));

    // ---- 🎵 the music player: one queue, one bar above the dock ----------
    const spotify = new Spotify({
      clientId: () => this.state.settings.spotifyClientId ?? "",
      get: () => this.state.device.spotify ?? null,
      set: async (t) => { this.state.device.spotify = t; await this.state.saveDevice(); this.state.notify(); },
    });
    this.music = new MusicPlayer(this.app, {
      serverUrl: () => this.state.api.baseUrl,
      youtubeEnabled: () => this.state.device.youtube !== false,
      deviceToken: () => this.state.device.deviceToken ?? null,
      onChange: () => this.dock?.refresh(),
    }, spotify);
    this.registerObsidianProtocolHandler("scripture-graph-spotify", params => {
      const code = params["code"];
      if (!code) return void new Notice(`Spotify sign-in failed: ${params["error"] ?? "no code"}`);
      spotify.completeConnect(code).catch(e => new Notice((e as Error).message));
    });
    this.app.workspace.onLayoutReady(() => this.music.mount());
    this.register(() => this.music.destroy());

    // ---- one-tap family setup (obsidian://scripture-graph-setup?server=…&invite=…)
    this.registerObsidianProtocolHandler("scripture-graph-setup", params => {
      this.app.workspace.onLayoutReady(() => void runSetupLink(this, params).catch(e => new Notice(`Setup failed: ${(e as Error).message}`, 10000)));
    });

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
    registerEnochStudy(this, path => this.ensureLocal(path));
    registerAtlas(this, path => this.ensureLocal(path));
    registerCommandmentsStudy(this, path => this.ensureLocal(path));

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
    this.registerPageView(TIMELINE_VIEW, (leaf) => new TimelineView(leaf, this.state));
    this.registerPageView(LIBRARY_VIEW,
      (leaf) => new SGLibraryView(leaf, this.state, this.navigatorHost()));
    this.addCommand({
      id: "open-timeline", name: "Open the timeline", icon: "history",
      callback: () => void this.openTimeline(null),
    });
    this.addCommand({
      id: "graph-presets", name: "Open graph views (pre-filtered)", icon: "git-fork",
      callback: () => this.openGraphPresets(),
    });
    this.addCommand({
      id: "hard-questions", name: "Open hard questions", icon: "help-circle",
      callback: () => this.openLibraryShelf(v => v.showQuestions()),
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
      id: "finish-update", name: "Finish updating (after sync)", icon: "download",
      callback: () => void this.checkSyncedUpdate(false),
    });
    this.addCommand({
      id: "sync-now", name: "Sync now", icon: "refresh-cw",
      // This used to sync highlights ONLY and then say "Synced" whether or
      // not anything worked — so a device that was days behind stayed behind
      // and told its reader everything was fine. One button, everything, and
      // the truth about what happened.
      callback: () => void this.syncEverything(),
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
    // ---- ‹ back pill: after following a link away from a chapter, one
    // labeled tap returns to exactly where you were reading ----------------
    const back = document.body.createDiv({ cls: "sg-back-pill" });
    back.onclick = () => {
      const p = this.lastReadingPath;
      const f = p ? this.app.vault.getAbstractFileByPath(p) : null;
      if (f instanceof TFile) void this.app.workspace.getLeaf().openFile(f);
    };
    this.register(() => back.remove());
    this.backPillEl = back;
    // ⌂ the dock: GL's bottom bar on every device (device.dock = false turns it
    // off). Mounted once the workspace exists — asking it for a leaf during
    // onload throws and takes the plugin down with it (user-reported "Failed")
    this.app.workspace.onLayoutReady(() => {
      if (this.state.device.dock !== false) {
        try { this.mountDock(); } catch (e) { console.error("scripture-graph: dock", e); }
      }
    });
    applyReading(this.state);
    // Focus reading hides every bar; this is the quiet way back out (and Esc).
    const focusExit = document.body.createEl("button", { cls: "sg-focus-exit", text: "Leave focus",
      attr: { "aria-label": "Leave focus reading" } });
    focusExit.onclick = () => saveReading(this.state, { focus: false });
    this.register(() => focusExit.remove());
    this.registerDomEvent(document, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && readingPrefs(this.state).focus && !document.querySelector(".modal-container, .menu")) {
        saveReading(this.state, { focus: false });
      }
    });
    // 🔁 vault sync: the shared tree from the family server, personal notes both ways
    this.vaultSync = new VaultSync(this.state, () => this.state.device.displayName ?? "device");
    setLazyFetch((n) => this.ensureLocal(n));
    this.register(() => setLazyFetch(null));
    const originalResourcePath = this.app.vault.getResourcePath;
    const trackedResourcePath = (file: TFile) => {
      this.vaultSync.recordAccess(file.path);
      return originalResourcePath.call(this.app.vault, file);
    };
    this.app.vault.getResourcePath = trackedResourcePath;
    this.register(() => {
      if (this.app.vault.getResourcePath === trackedResourcePath) this.app.vault.getResourcePath = originalResourcePath;
    });
    this.addCommand({ id: 'connect-familysearch', name: 'Connect FamilySearch and view family import progress',
      callback: () => new FamilyConnectModal(this.state).open() });
    this.app.workspace.onLayoutReady(() => this.vaultSync.start());
    // A phone's 30-minute timer only runs while the app is awake, so a device
    // that is opened, read and closed can go days without a check. Coming back
    // to the app is itself a good moment to catch up.
    this.registerDomEvent(document, "visibilitychange", () => {
      if (!document.hidden) this.vaultSync.catchUp();
    });
    this.registerDomEvent(window, "focus", () => this.vaultSync.catchUp());
    this.register(() => this.vaultSync.stop());
    this.registerEvent(this.app.vault.on("modify", f => this.vaultSync.noteChanged(f.path)));
    this.registerEvent(this.app.vault.on("create", f => this.vaultSync.noteChanged(f.path)));
    this.registerEvent(this.app.vault.on("delete", f => this.vaultSync.noteChanged(f.path)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => { this.vaultSync.noteChanged(old); this.vaultSync.noteChanged(f.path); }));
    this.addCommand({
      id: "update-from-server", name: "Update the plugin from the family server now", icon: "download",
      callback: () => void this.checkForUpdate(false),
    });
    this.addCommand({
      id: "vault-sync-now", name: "Sync the vault now", icon: "refresh-cw",
      callback: () => void this.syncEverything(),
    });
    this.addCommand({
      id: "reading-settings", name: "Reading settings (text size, spacing, typeface)", icon: "type",
      callback: () => this.openReadingSettings(),
    });
    this.addCommand({
      id: "toggle-focus-reading", name: "Focus reading (hide every bar)", icon: "focus",
      callback: () => { saveReading(this.state, { focus: !readingPrefs(this.state).focus }); },
    });
    this.addCommand({
      id: "open-my-marks", name: "My highlights and notes", icon: "highlighter",
      callback: () => this.openLibraryShelf(v => v.showMarks()),
    });
    this.addCommand({
      id: "toggle-dock", name: "Toggle the bottom navigation bar", icon: "panel-bottom",
      callback: () => {
        this.state.device.dock = this.state.device.dock === false;
        void this.state.saveDevice();
        if (this.state.device.dock !== false) this.mountDock(); else this.unmountDock();
      },
    });
    // Mobile drawers open through their buttons, never an accidental swipe.
    registerSidebarSwipeGuard(this);
    registerSidebarNavigation(this, () => this.openLibraryShelf(v => v.showHome()));
    // 👉 phone: swipe left/right turns the chapter like a page
    registerSwipeNav(this, this.state, (title) => this.openMyStudy(title));
    registerKeyboardNav(this, this.state, (title) => { void this.openKeyboardChapter(title); });
    this.applyReadingPrefs();
    registerKeyboardWatch(this);   // the half-page bug: a stuck keyboard height
    document.body.toggleClass("sg-hide-ai-lib", !this.state.device.showAiLibrary);
    this.register(() => {
      document.body.removeClass("sg-hide-ai-lib");
      document.body.removeClass("sg-fab-on");
      document.body.removeClass("sg-back-on");
    });

    // ---- study-trail tracking + read-only enforcement ----------------------
    this.registerEvent(this.app.workspace.on("file-open", f => {
      if (!f) return;
      if (isSupplementalPage(f.path) && supplementalChapterNumber(f.basename) !== null) {
        void this.showSupplementalStudyFor(f);
        return;
      }
      this.vaultSync.recordAccess(f.path);
      if (f.extension === 'md') void this.fetchEmbeds(f.path);
      this.studyBar.clear();          // selections never follow you across pages
      closeAllSheets();               // navigation folds every floating layer
      // THE invariant: an AI Library page (other than scripture itself) never
      // stays open as a page — however it was reached: a link we route, a
      // search result, a graph node, a backlink, or a door not built yet
      if (this.bounceAiPage(f)) return;
      this.study.recordVisit(f);
      this.recordLastChapter(f);
      this.updateNavFab(f);
      this.updateBackPill(f);
      this.updateViewChrome(f);
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
    const ensureAiAction = () => {
      const file = this.app.workspace.getActiveFile();
      if (file) this.addMyStudyAction(file);
    };
    this.registerEvent(this.app.workspace.on("layout-change", ensureAiAction));
    this.registerEvent(this.app.workspace.on("active-leaf-change", ensureAiAction));
    this.app.workspace.onLayoutReady(ensureAiAction);
    this.app.workspace.onLayoutReady(() => {
      const file = this.app.workspace.getActiveFile();
      if (file && isSupplementalPage(file.path) && supplementalChapterNumber(file.basename) !== null) void this.showSupplementalStudyFor(file);
    });

    // ---- chapter links land on the EDITABLE My Notes page (§user) ----------
    // Verse-anchored links ("Alma 36#^alma-36-18") keep opening canonical —
    // block anchors only exist there. Bare chapter links redirect to the
    // personal companion, which embeds the same scripture and is yours to edit.
    // AI Library pages (topics, talks, people, evidence...) never navigate at
    // all: they open as a floating sheet over the page being read.
    this.origOpenLinkText = this.app.workspace.openLinkText.bind(this.app.workspace);
    const orig = this.origOpenLinkText;
    this.app.workspace.openLinkText = async (linktext: string, sourcePath: string,
      newLeaf?: unknown, openViewState?: unknown) => {
      // a shared page this device hasn't downloaded: fetched now, kept after
      await this.ensureLocal(linktext);
      const chapterBase = linktext.split('#')[0]!;
      const scriptureTarget = this.app.metadataCache.getFirstLinkpathDest(chapterBase, sourcePath)
        ?? this.app.vault.getAbstractFileByPath(this.vaultSync.pathFor(chapterBase) ?? chapterBase);
      if (!newLeaf && !linktext.includes('#') && scriptureTarget instanceof TFile && await this.openLessonDocument(scriptureTarget.path)) return;
      if (!linktext.includes('#') && scriptureTarget instanceof TFile && isSupplementalPage(scriptureTarget.path)
        && supplementalChapterNumber(scriptureTarget.basename) !== null) {
        const study = await this.ensureSupplementalStudy(scriptureTarget.basename);
        await this.app.workspace.getLeaf(false).openFile(study, { state: { mode: 'preview' } });
        return;
      }
      // verse references PEEK — the verse comes to the reader, and "Open
      // chapter" inside the card is the deliberate way to actually travel
      const peek = peekTargetFor(this.app, linktext, sourcePath);
      if (peek) {
        new VersePeekModal(this.state, peek, () => {
          void orig(linktext, sourcePath, newLeaf as never, openViewState as never);
        }).open();
        return Promise.resolve();
      }
      const sheet = sheetTargetFor(this.app, linktext, sourcePath);
      if (sheet) {
        this.openLibrarySheet(sheet, linktext.split("#")[1] ?? null);
        return Promise.resolve();
      }
      const redirect = this.companionForLink(linktext, sourcePath);
      return orig(redirect ?? linktext, sourcePath, newLeaf as never,
        openViewState as never);
    };

    // ---- deferred startup --------------------------------------------------
    this.app.workspace.onLayoutReady(() => {
      // 🧭 a fresh tab IS the navigator: Obsidian's "Create new note /
      // Go to file" empty page never earns a spot — every empty leaf in
      // the main area becomes the Library, on launch and on every +
      const adoptEmpties = () => {
        const ws = this.app.workspace;
        for (const l of ws.getLeavesOfType("empty")) {
          const root = l.getRoot();
          if (root === ws.leftSplit || root === ws.rightSplit) continue;
          void l.setViewState({ type: LIBRARY_VIEW, active: l === ws.activeLeaf });
        }
      };
      adoptEmpties();
      this.registerEvent(this.app.workspace.on("layout-change", adoptEmpties));
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
        // always know what build you're on — the toast is the proof. Keyed
        // on the CODE version: a synced manifest alone is not a new build
        const seen = await this.state.store.get<string>("last_loaded_version");
        if (seen !== BUILD.version) {
          await this.state.store.put("last_loaded_version", BUILD.version);
          new Notice(`Scripture Graph v${BUILD.version} loaded (build ${BUILD.sha})`);
        }
        if (BUILD.version !== this.manifest.version) {
          // the exact state that sent a v0.61.0 log from pre-0.61 code
          new Notice(`Running v${BUILD.version} code under a v${this.manifest.version} manifest — `
            + "sync hasn't finished delivering main.js; you'll be offered a reload when it lands", 12000);
        }
        trace("boot", { code: BUILD.version, sha: BUILD.sha, manifest: this.manifest.version,
          mobile: Platform.isMobile });
        if (this.state.device.debugOverlay) {
          const { setOverlay } = await import("./study/trace");
          setOverlay(true);
        }
        // the navigator FAB + Continue card work immediately after (re)load,
        // not only after the next file-open
        const f0 = this.app.workspace.getActiveFile();
        if (f0) {
          this.recordLastChapter(f0);
          this.updateNavFab(f0);
        }
        // ambient scene: restore + hourly re-pick when following the clock.
        // "match" is a MODE, not a scene id — handing it to apply() picked
        // the first scene in the list on every relaunch (user-reported)
        this.applyConfiguredScene(f0);
        this.registerInterval(window.setInterval(() => {
          if (this.state.device.scene === "auto") this.scenes.apply("auto");
        }, 15 * 60_000));
        // Updates must work even when family-server identity or sync is offline.
        void this.checkForUpdate(true);
        this.registerInterval(window.setInterval(() => void this.checkForUpdate(true), 20 * 60_000));
        this.registerDomEvent(document, "visibilitychange", () => {
          if (!document.hidden) void this.checkForUpdate(true);
        });
        // Keep live recovery independent of migrations/identity requests.
        this.live = new LiveLink(this);
        this.live.start();
        this.register(() => this.live?.stop());
        if (await this.state.store.get<boolean>(SETUP_RESUME_KEY)) {
          void runSetupLink(this, {}).catch(e => new Notice(`Reconnect: ${(e as Error).message}`, 10000));
        }
        await migrateFromAnnotate(this.state);
        this.ann.start();
        await refreshIdentity(this.state);
        // Joining is the difference between a vault with scriptures and an
        // empty one, so an unjoined vault asks again — every launch, unless
        // the reader said "maybe later" today. (Before, a single dismissal
        // silenced it forever and left the vault permanently empty.)
        if (!this.state.signedIn) {
          const snoozed = (await this.state.store.get<number>(WELCOME_SNOOZE_KEY)) ?? 0;
          if (Date.now() >= snoozed) {
            new WelcomeModal(this.state, this.ai, () => { /* noop */ },
              () => void this.state.store.put(WELCOME_SNOOZE_KEY, Date.now() + 24 * 3600_000)).open();
          }
        }
        // self-update from the family server (kills sync-delivery roulette)
        // every launch, and again every 20 minutes while open: one small
        // request to the LAN server; the vault sync makes Sync-delivery
        // optional, so the server must be the reliable channel
        await this.state.store.put("update_checked_at", Date.now());
        // ⚡ the live channel: a held request the server answers the moment
        // a build or a vault change lands — install + reload, no tap
        // Sync can land a build any time, from anywhere — notice it on
        // open, every few minutes, and whenever the app comes back up
        void this.checkSyncedUpdate();
        this.registerInterval(window.setInterval(
          () => void this.checkSyncedUpdate(), 5 * 60_000));
        this.registerDomEvent(window, "focus", () => void this.checkSyncedUpdate());
      })();
    });
  }

  // ------------------------------------------------------------ self-update

  private updateRunning = false;
  private updateTask: Promise<boolean | void> | null = null;

  private registerPageView(type: string, create: (leaf: WorkspaceLeaf) => ItemView): void {
    this.registerView(type, leaf => {
      const view = rememberReadingPosition(create(leaf));
      this.bookmarkReading.attach(view);
      return view;
    });
  }

  /** Pull the latest build from the permanent GitHub release channel and
   * install it in place. `silent` = only speak when something happens. */
  async checkForUpdate(silent: boolean): Promise<boolean | void> {
    if (this.updateTask) {
      const updated = await this.updateTask;
      if (updated || silent) return updated;
    }
    const work = this.checkForUpdateOnce(silent);
    this.updateTask = work;
    try { return await work; } finally { if (this.updateTask === work) this.updateTask = null; }
  }

  private async checkForUpdateOnce(silent: boolean): Promise<boolean | void> {
    if (this.updateRunning || (silent && document.hidden)) return;
    this.updateRunning = true;
    const get = async (url: string, timeoutMs = 20_000) => {
      let timer: number | undefined;
      try {
        return await Promise.race([
          requestUrl({ url, throw: false }),
          new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error("Update connection timed out")), timeoutMs); }),
        ]);
      } finally { if (timer !== undefined) window.clearTimeout(timer); }
    };
    try {
      const releases = "https://github.com/JaceRichins/scripture-graph/releases";
      const channel = async (base: string) => {
        const mf = await get(`${base}/manifest.json`);
        if (mf.status !== 200) throw new Error(`HTTP ${mf.status}`);
        return { base, text: mf.text };
      };
      const release = await newestRelease([
        async () => {
          await this.state.api.where();
          return channel(`${this.state.api.baseUrl.replace(/\/$/, '')}/plugin`);
        },
        () => channel(`${releases}/latest/download`),
      ]);
      const { manifest } = release;
      const remote = manifest.version;
      let base = release.base;
      // compare against the CODE, not the manifest — a device holding a
      // synced manifest over old code still needs the pull
      if (!newerVersion(remote, BUILD.version)) {
        if (!silent) new Notice(`Up to date — v${BUILD.version}`);
        return;
      }
      // Pin assets to the manifest's release, even if a new release appears
      // during this download. No family credentials are sent to GitHub.
      if (base === `${releases}/latest/download`) base = `${releases}/download/${remote}`;
      const [main, styles] = await Promise.all([
        // The plugin includes the complete UI cover collection. Allow time
        // for this one update download on slower mobile connections.
        get(`${base}/main.js`, 120_000),
        get(`${base}/styles.css`),
      ]);
      if (main.status !== 200 || styles.status !== 200 || main.text.length < 10_000 || BANNER_RE.exec(main.text)?.[1] !== remote) {
        if (!silent) new Notice("Update download failed — try again");
        return;
      }
      // A foreground check will try again after the person finishes typing.
      if (silent && document.activeElement?.matches("input, textarea, [contenteditable='true']")) return;
      const dir = `${this.app.vault.configDir}/plugins/scripture-graph`;
      const ad = this.app.vault.adapter;
      await ad.write(`${dir}/main.js`, main.text);
      if (styles.status === 200) await ad.write(`${dir}/styles.css`, styles.text);
      await ad.write(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
      new Notice(`Scripture Graph updated to v${remote} — reloading…`, 8000);
      window.setTimeout(() => {
        const cmds = (this.app as unknown as {
          commands?: { executeCommandById?: (id: string) => void };
        }).commands;
        cmds?.executeCommandById?.("app:reload");
      }, 900);
      return true;
    } catch (e) {
      if (!silent) new Notice(`Update check failed: ${(e as Error).message}`);
    } finally {
      this.updateRunning = false;
    }
  }

  /** Also adopt builds delivered by Obsidian Sync once their code arrives. */
  private syncedOffered: string | null = null;

  async checkSyncedUpdate(silent = true): Promise<void> {
    try {
      const dir = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
      const ad = this.app.vault.adapter;
      const raw = await ad.read(`${dir}/manifest.json`);
      const disk = (JSON.parse(raw.replace(/^﻿/, "")) as { version?: string }).version ?? "";
      if (!newerVersion(disk, BUILD.version)) {
        if (!silent) new Notice(`Up to date — v${BUILD.version}`);
        return;
      }
      // The manifest is 350 bytes and lands first; main.js is 590 KB and
      // lands later. A reload in between loads the new manifest over the
      // OLD code. Read the banner off main.js and offer the reload only
      // once the code on disk is the version the manifest promises.
      const head = (await ad.read(`${dir}/main.js`)).slice(0, 160);
      const onDisk = BANNER_RE.exec(head)?.[1] ?? "";
      if (onDisk !== disk) {
        trace("sync.partial", { manifest: disk, code: onDisk || "unbannered", running: BUILD.version });
        if (!silent) new Notice(`v${disk} is still syncing — the manifest is here, main.js `
          + `(${onDisk ? "v" + onDisk : "an older build"}) is on its way`);
        return;
      }
      if (document.hidden || document.activeElement?.matches("input, textarea, [contenteditable='true']")) return;
      if (this.syncedOffered === disk) return;
      this.syncedOffered = disk;
      const reload = () => (this.app as unknown as { commands?: { executeCommandById?: (id: string) => void } })
        .commands?.executeCommandById?.("app:reload");
      new Notice(`Scripture Graph v${disk} — reloading…`, 4000);
      window.setTimeout(reload, 600);
    } catch {
      if (!silent) new Notice("Couldn't read the plugin folder to check for an update");
    }
  }

  onunload() {
    this.scenes.apply('none');
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
    if (supplementalChapterNumber(chapterTitle) !== null) { void this.openKeyboardChapter(chapterTitle); return; }
    const open = (link: string) => (this.origOpenLinkText ?? this.app.workspace.openLinkText)(link, "");
    // A member's personal tree starts empty, so the study page is made on the
    // first tap and the chapter itself is fetched if this device lacks it.
    void openChapterStudy({
      companion: title => this.app.metadataCache.getFirstLinkpathDest(`${title} - My Notes`, "")?.path ?? null,
      canonical: title => this.app.metadataCache.getFirstLinkpathDest(title, "")?.path
        ?? (this.vaultSync.pathFor(title) && this.app.vault.getAbstractFileByPath(this.vaultSync.pathFor(title)!) ? this.vaultSync.pathFor(title) : null),
      ensureLocal: title => this.ensureLocal(title),
      create: async (path, body) => { await this.createPersonalPage(path, body); },
      open: async link => { await open(link); },
      signedIn: () => this.state.signedIn,
      connect: message => this.promptConnect(message),
      notify: message => { new Notice(message, 8000); },
    }, chapterTitle).catch(() => new Notice("Couldn't open that chapter. Please try again."));
  }

  /** Everything this device should have: the shared library and the reader's
   * own notes and highlights, in one press, saying plainly what happened. */
  async syncEverything(): Promise<string> {
    if (!this.state.signedIn) {
      this.promptConnect("This vault isn't connected to your family library yet, so there is nothing to sync.");
      return "not connected";
    }
    const before = this.vaultSync.status.files;
    const progress = new Notice("Syncing with the family server…", 0);
    const paint = () => {
      const st = this.vaultSync.status;
      if (st.running && st.total) progress.setMessage(`Downloading ${st.done.toLocaleString()} of ${st.total.toLocaleString()} files…`);
      else if (st.phase === "reconnecting") progress.setMessage("Found the family server at a new address — syncing…");
    };
    this.vaultSync.listeners.push(paint);
    let notes: string | null = null;
    try {
      const results = await Promise.allSettled([this.vaultSync.run("manual"), this.ann.syncNow(true)]);
      const failed = results[1];
      if (failed.status === "rejected") notes = String(failed.reason?.message ?? failed.reason);
    } finally {
      this.vaultSync.listeners = this.vaultSync.listeners.filter(l => l !== paint);
      progress.hide();
    }
    const st = this.vaultSync.status;
    const error = st.lastError ?? notes;
    const gained = st.files - before;
    const message = error
      ? `Sync failed: ${error}. Your notes are safe on this device and will go up when it connects.`
      : `Synced — ${gained > 0 ? `${gained.toLocaleString()} new or updated files, ` : "already up to date, "}`
        + `${st.files.toLocaleString()} files on this device.`;
    new Notice(message, error ? 15000 : 8000);
    this.state.notify();
    return message;
  }

  /** a personal page and the folders above it */
  private async createPersonalPage(path: string, body: string): Promise<void> {
    const parts = path.split("/").slice(0, -1);
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join("/");
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        try { await this.app.vault.createFolder(folder); } catch (e) { if (!this.app.vault.getAbstractFileByPath(folder)) throw e; }
      }
    }
    await this.app.vault.create(path, body);
  }

  /** Nothing works until this device has joined the family. Say so wherever
   * the reader actually is, and open the one screen that fixes it. */
  private lastConnectPrompt = 0;
  promptConnect(message: string): void {
    if (this.state.signedIn) return;
    if (Date.now() - this.lastConnectPrompt < 30_000) return;   // one answer per flurry of taps
    this.lastConnectPrompt = Date.now();
    const note = new Notice(`${message}`, 12000);
    note.noticeEl.createEl("br");
    const button = note.noticeEl.createEl("button", { text: "Connect now" });
    button.style.marginTop = "8px";
    button.onclick = () => { note.hide(); new WelcomeModal(this.state, this.ai, () => this.state.notify()).open(); };
  }

  private ensureSupplementalStudy(title: string): Promise<TFile> {
    return commandmentsChapterNumber(title) !== null
      ? ensureCommandmentsStudy(this.app, title) : ensureEnochStudy(this.app, title);
  }

  private async showSupplementalStudyFor(file: TFile): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.path !== file.path) return;
    view.containerEl.addClass('sg-supplemental-page');
    try {
      const study = await this.ensureSupplementalStudy(file.basename);
      // Creating the personal page may take a moment; don't pull someone back
      // after they have already navigated elsewhere.
      if (view.file?.path === file.path && this.app.workspace.activeLeaf === view.leaf)
        await view.leaf.openFile(study, { state: { mode: 'preview' } });
    } catch { new Notice("Couldn't open the scripture study page. Please try again."); }
  }

  /** 🕰 the timeline view, optionally scrolled to a year */
  /** the timeline replaces the CURRENT page, with that page behind it in
   * history — never a jump to some older Timeline tab, which has nothing
   * behind it and leaves the navbar's ‹ dead (user-reported) */
  private async timelineLeaf(): Promise<WorkspaceLeaf> {
    const leaf = this.app.workspace.getLeaf(false);
    if (leaf.view.getViewType() !== TIMELINE_VIEW) {
      recordHistory(leaf);
      await leaf.setViewState({ type: TIMELINE_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (leaf.view instanceof TimelineView) leaf.view.openCanvas();
    return leaf;
  }

  async openTimeline(year: number | null): Promise<void> {
    const leaf = await this.timelineLeaf();
    const view = leaf.view;
    if (view instanceof TimelineView && year != null) view.setYear(year);
  }

  /** the era line above verse 1 is a door into the timeline */
  async openTimelineForBook(bookSlug: string): Promise<void> {
    const { loadTimelineData } = await import("./study/timelineView");
    const data = await loadTimelineData(this.app);
    const y = data?.book_years?.[bookSlug] ?? null;
    await this.openTimeline(y);
  }

  /** does this page name a subject the chronology knows? (entity sheets get
   * a ⏳ door straight into that subject's focused timeline) */
  private tlSubjects: Map<string, Subject> | null = null;
  private tlSubjectsAt = 0;

  private async timelineSubjects(): Promise<Map<string, Subject>> {
    if (this.tlSubjects && Date.now() - this.tlSubjectsAt < 300_000) return this.tlSubjects;
    const { loadTimelineData } = await import("./study/timelineView");
    const data = await loadTimelineData(this.app);
    const m = new Map<string, Subject>();
    for (const e of data?.events ?? []) {
      for (const kind of ["topics", "doctrines", "sources", "events", "people", "places", "things"] as const) {
        for (const name of e[kind] ?? []) {
          m.set(name.toLowerCase(), { kind, name });
          // plural subjects resolve to their singular page and back
          if (kind === 'people' && name.toLowerCase().endsWith("ies")) {
            m.set(name.toLowerCase().slice(0, -3) + "i", { kind, name });
          } else if (kind === 'people' && name.toLowerCase().endsWith("s")) {
            m.set(name.toLowerCase().slice(0, -1), { kind, name });
          }
        }
      }
    }
    this.tlSubjects = m;
    this.tlSubjectsAt = Date.now();
    return m;
  }

  /** jump to the timeline focused on one subject */
  async openTimelineFocus(subject: Subject): Promise<void> {
    const leaf = await this.timelineLeaf();
    const view = leaf.view;
    if (view instanceof TimelineView) view.setFocus(subject);
  }

  /** the timeline pre-shaped by the shelf: whole story, one lane, or a saved mix */
  private async openTimelinePreset(p: TimelinePreset): Promise<void> {
    const leaf = await this.timelineLeaf();
    const view = leaf.view;
    if (view instanceof TimelineView) view.applyPreset(p);
  }

  /** build-your-own timeline: the picker saves to this device (same name
   * replaces, never duplicates), then the shelf redraws itself */
  private newTimeline(onDone: () => void): void {
    openTimelinePicker(this.state,
      (this.state.device.myTimelines ?? []).map(t => t.name),
      (t) => {
        const mine = this.state.device.myTimelines ?? [];
        const at = mine.findIndex(x => x.name === t.name);
        if (at >= 0) mine[at] = t; else mine.push(t);
        this.state.device.myTimelines = mine;
        void this.state.saveDevice();
        onDone();
      });
  }

  private dock: Dock | null = null;
  vaultSync!: VaultSync;
  live: LiveLink | null = null;
  music!: MusicPlayer;

  openReadingSettings(): void {
    new ReadingSettingsModal(this.state, () => this.pickScene(), () => {
      this.state.device.dock = this.state.device.dock === false;
      void this.state.saveDevice();
      if (this.state.device.dock !== false) this.mountDock(); else this.unmountDock();
    }).open();
  }

  private mountDock(): void {
    if (this.dock) return;
    const narrator = new FamilyNarrator(this.app, this.music, {
      ensure: path => this.ensureLocal(path),
      refreshIndex: async () => { await this.vaultSync.refreshCatalog(); await this.vaultSync.fetchNow(NARRATION_INDEX); },
      resource: path => {
        const file = this.app.vault.getAbstractFileByPath(path);
        return file instanceof TFile ? this.app.vault.getResourcePath(file) : null;
      },
    });
    const internals = obsidianInternals(this.app);
    this.dock = new Dock(this.state, {
      listenFamily: file => narrator.toggle(file),
      familyAudioState: file => narrator.state(file),
      openHome: () => this.openLibraryShelf(v => v.showHome()),
      openLibrary: () => this.openLibraryShelf(v => v.showScriptures()),
      openSearch: () => this.openLibraryShelf(v => v.showSearch()),
      openMarks: () => this.openLibraryShelf(v => v.showMarks()),
      openAsk: () => {
        const state = this.app.workspace.activeLeaf?.view.getState() as { chapter?: string; path?: string } | undefined;
        const file = this.app.workspace.getActiveFile();
        const title = this.app.workspace.activeLeaf?.view.getViewType() === LIBRARY_VIEW ? null : state?.chapter ?? (file?.path.startsWith(CANONICAL_PREFIX) ? file.basename : null);
        void this.openAsk(title, null);
      },
      openTabs: () => internals.mobileTabSwitcher ? internals.mobileTabSwitcher.show() : this.openDockTabs(),
      tabsMenu: (e) => internals.mobileTabSwitcher ? internals.mobileTabSwitcher.showTabManagementMenu(e) : this.openDockTabs(),
      ribbonMenu: (e) => internals.mobileNavbar ? internals.mobileNavbar.showRibbonMenu(e) : this.openReadingSettings(),
      reviewFlashcards: () => void this.study.review(),
      openPath: (p) => void this.app.workspace.openLinkText(p, ""),
      // the page under the dock, whichever view holds it
      currentPage: () => this.currentBookmarkPage()?.file ?? null,
      bookmarkControls: this.bookmarkControls,
      openBookmarks: () => this.openBookmarkList(),
      bookmarkOf: f => this.study.bookmarkOf(f),
      bookmark: (f) => this.study.bookmarkFile(f),
      unbookmark: (a) => this.study.unbookmark(a),
      // 🎧 on a talk: its YouTube version, found once and remembered
      playVideo: async (f) => {
        const id = (await youtubeIdOf(this.app, f)) ?? (await findTalkVideo(this.app, f));
        if (!id) return false;
        if (this.music.isCurrent(`yt:${id}`)) { this.music.toggle(); return true; }
        // 🎧 is listening: the talk's sound, which keeps going with the screen off
        this.music.playVideo(id, pageTitle(f), docKindFor(f.path)?.eyebrow ?? "Video", undefined, false);
        return true;
      },
      videoState: () => this.music.videoState,
      toggleVideo: () => this.music.toggle(),
      currentCfmWeek: async () => {
        const f = this.app.vault.getAbstractFileByPath("AI Library/00 System/Come Follow Me.md");
        if (!(f instanceof TFile)) return null;
        try {
          const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
          const weeks = (m ? JSON.parse(m[1]!).weeks : []) as { week: string; start: string; end: string }[];
          const today = new Date().toISOString().slice(0, 10);
          return weeks.find(w => w.start <= today && today <= w.end)?.week ?? null;
        } catch { return null; }
      },
      openNote: (l) => void this.ensureLocal(l).then(() => (this.origOpenLinkText ?? this.app.workspace.openLinkText)(l, "")),
    });
    this.dock.mount();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.dock?.refresh()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.dock?.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.dock?.refresh()));
    this.register(() => this.unmountDock());
  }

  private unmountDock(): void {
    this.dock?.unmount();
    this.dock = null;
  }

  /** Page turns also work on a new device without personal chapter notes. */
  private async openKeyboardChapter(title: string): Promise<void> {
    if (supplementalChapterNumber(title) !== null) {
      const study = await this.ensureSupplementalStudy(title);
      await this.app.workspace.getLeaf(false).openFile(study, { state: { mode: 'preview' } });
      return;
    }
    let file = this.app.metadataCache.getFirstLinkpathDest(`${title} - My Notes`, "");
    if (!file) {
      if (!(await this.ensureLocal(title))) {
        new Notice("Couldn't open that chapter. Check the family server connection.");
        return;
      }
      file = this.app.metadataCache.getFirstLinkpathDest(title, "");
      if (!file) {
        const path = this.vaultSync.pathFor(title);
        const found = path ? this.app.vault.getAbstractFileByPath(path) : null;
        if (found instanceof TFile) file = found;
      }
    }
    if (file) await this.app.workspace.getLeaf(false).openFile(file, { state: { mode: "preview" } });
  }

  /** Desktop has no mobile tab switcher; expose its open leaves directly. */
  private openDockTabs(): void {
    const modal = new Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Open tabs" });
    this.app.workspace.iterateRootLeaves(leaf => {
      new Setting(modal.contentEl)
        .setName(leaf.view.getDisplayText())
        .addButton(button => button.setButtonText("Open").onClick(() => {
          this.app.workspace.setActiveLeaf(leaf, { focus: true });
          modal.close();
        }));
    });
    modal.open();
  }

  /** the shared host every navigation surface drives */
  /** a link or path to a shared page: make sure the device holds it. True
   * when it is here now (already, or just fetched). */
  async ensureLocal(linkOrPath: string): Promise<boolean> {
    const base = linkOrPath.split("#")[0]!.trim();
    if (!base) return true;
    const existing = this.app.metadataCache.getFirstLinkpathDest(base, "") ?? this.app.vault.getAbstractFileByPath(base);
    if (existing) {
      this.vaultSync.recordAccess(existing.path);
      // The page can survive while its attachments were pruned or interrupted.
      if (existing instanceof TFile && existing.extension === 'md') void this.fetchEmbeds(existing.path);
      return true;
    }
    // Not joined yet: the library is unreachable by definition. Say that
    // instead of resolving nothing and letting the tap do nothing at all.
    if (!this.state.signedIn) {
      this.promptConnect("This vault isn't connected to your family library yet, so there are no scriptures to open.");
      return false;
    }
    let path = this.vaultSync.pathFor(base);
    if (!path) {
      try { await this.vaultSync.refreshCatalog(); } catch { return false; }
      path = this.vaultSync.pathFor(base);
    }
    if (!path) return false;
    const isPage = path.endsWith(".md");
    const note = isPage ? new Notice(`Fetching ${base.split("/").pop()}…`, 0) : null;
    const ok = await this.vaultSync.fetchNow(path);
    note?.hide();
    if (!ok) { if (isPage) new Notice("Couldn't reach the family server for that page."); return false; }
    // a page's pictures and documents come with it — nothing heavier than
    // what that one page shows, and only when someone opens it
    if (isPage) void this.fetchEmbeds(path);
    return ok;
  }

  private embedLoads = new Set<string>();
  private async fetchEmbeds(path: string): Promise<void> {
    if (this.embedLoads.has(path)) return;
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return;
    this.embedLoads.add(path);
    try {
      const text = await this.app.vault.cachedRead(f);
      await fetchMissingEmbeds(text, path, {
        local: link => !!this.app.metadataCache.getFirstLinkpathDest(link, path),
        resolve: candidate => this.vaultSync.pathFor(candidate),
        refresh: () => this.vaultSync.refreshCatalog(),
        fetch: target => this.vaultSync.fetchNow(target),
      });
    } catch { /* the page still reads; pictures show as they arrive */ }
    finally { this.embedLoads.delete(path); }
  }

  /** the scene the reader chose (or the clock, or the chapter) — applied
   * on launch and again when a page that borrowed the backdrop lets go */
  applyConfiguredScene(f0?: TFile | null): void {
    this.scenes.apply(configuredSceneId(this.state.device.scene, this.state.device.lastMatchedScene));
    if (this.state.device.scene === "match") {
      const f = f0 ?? this.app.workspace.getActiveFile();
      if (f) void this.matchSceneToChapter(f);
    }
  }

  /** what the assistant may do in the app, through the reader's own paths */
  private askHost(): AskHost {
    return {
      openMyWork: () => this.openLibraryShelf(v => v.showMyWork()),
      openChapter: async t => {
        if (!(await this.ensureLocal(t))) throw new Error("That chapter isn't available on this device yet.");
        await (this.origOpenLinkText ?? this.app.workspace.openLinkText)(t, "");
      },
      openNote: async l => {
        if (!(await this.ensureLocal(l))) throw new Error("That page isn't available on this device yet.");
        if (!l.includes('#') && await this.openLessonDocument(l)) return;
        await (this.origOpenLinkText ?? this.app.workspace.openLinkText)(l, "");
        if (isPhone()) {
          this.app.workspace.rightSplit.collapse();
        }
      },
      ensure: l => this.ensureLocal(l),
      pathFor: l => this.vaultSync.pathFor(l) ?? null,
      scene: (id) => { if (id) this.scenes.apply(id); else this.applyConfiguredScene(); },
      readingPrefs: () => this.applyReadingPrefs(),
      // the Aa sheet's settings, through the same path the sheet uses
      setReading: patch => saveReading(this.state, patch),
      readingState: () => readingSnapshot(this.state),
    };
  }

  /** the reading font and size from device settings, as CSS on the body */
  applyReadingPrefs(): void {
    applyBackgroundVisibility(document.body.style, this.state.device.backgroundVisibility);
    const d = this.state.device;
    const b = document.body;
    if (d.readScale && d.readScale !== 1) b.style.setProperty("--font-text-size", `${Math.round(16 * d.readScale)}px`);
    else b.style.removeProperty("--font-text-size");
    if (d.readFont) b.style.setProperty("--font-text", `"${d.readFont.replace(/"/g, "")}", var(--font-interface)`);
    else b.style.removeProperty("--font-text");
  }

  private navigatorHost(): NavigatorHost {
    return {
      ann: this.ann,
      openChapter: t => this.openMyStudy(t),
      openNote: l => this.openNavigatorNote(l),
      downloadFolder: (p) => this.vaultSync.pinFolder(p),
      remoteCount: (p) => this.vaultSync.remoteCount(p),
      scene: (id) => { if (id) this.scenes.apply(id); else this.applyConfiguredScene(); },
      sceneCurrent: () => this.scenes.current(),
      scenePhoto: (id, wide) => this.scenes.cache?.get(id, wide) ?? Promise.reject(new Error('Photo cache unavailable')),
      playFiles: async (items) => {
        const queue: PlayItem[] = [];
        for (const it of items) {
          if (!(await this.ensureLocal(it.path))) continue;
          const f = this.app.vault.getAbstractFileByPath(it.path);
          if (!(f instanceof TFile)) continue;
          queue.push({ id: `file:${it.path}`, title: it.title, sub: it.sub, url: this.app.vault.getResourcePath(f),
            searchQuery: it.title, open: it.open });
        }
        if (!queue.length) { new Notice("That recording isn't reachable right now."); return; }
        this.music.play(queue, 0);
      },
      lastChapter: () => this.state.device.lastChapter,
      recentChapters: () => this.state.device.recentChapters ?? [],
      groupActivity: async () => {
        if (!this.state.device.deviceToken) return [];
        return (await this.state.api.groupActivity()).activity;
      },
      refreshCatalog: () => this.vaultSync.refreshCatalog(),
      listFolder: (path) => {
        const af = this.app.vault.getAbstractFileByPath(path);
        const folders: { name: string; path: string; remote?: boolean }[] = [];
        const files: { name: string; path: string; remote?: boolean }[] = [];
        if (af instanceof TFolder) {
          for (const ch of af.children) {
            if (ch instanceof TFolder) {
              if (ch.name.startsWith("_")) continue;          // _media and the like: plumbing, not a shelf
              folders.push({ name: ch.name, path: ch.path });
            } else if (ch instanceof TFile && ch.extension === "md"
              && !ch.basename.startsWith("_")) {
              files.push({ name: ch.basename, path: ch.path });
            }
          }
        }
        // and what the server offers under it that this device hasn't fetched
        {
          const remote = this.vaultSync.remoteUnder(path);
          const haveF = new Set(folders.map(f => f.name)), haveP = new Set(files.map(f => f.path));
          for (const f of remote.folders) if (!haveF.has(f.name)) folders.push({ ...f, remote: true });
          for (const f of remote.files) if (!haveP.has(f.path)) files.push({ ...f, remote: true });
          folders.sort((a, b) => a.name.localeCompare(b.name));
          files.sort((a, b) => a.name.localeCompare(b.name));
        }
        return { folders, files };
      },
      searchLibrary: query => this.state.api.search(query),
      openPath: (path) => {
        // through the wrapper: AI pages float as a sheet, scripture navigates
        void this.app.workspace.openLinkText(path, "");
      },
      music: this.music,
      openTimeline: () => void this.openTimeline(null),
      openMyWork: () => {
        this.openLibraryShelf(v => v.showMyWork());
      },
      openTimelinePreset: (p) => void this.openTimelinePreset(p),
      newTimeline: (onDone) => this.newTimeline(onDone),
    };
  }

  /** Open library destinations directly, including freshly downloaded records. */
  private async openNavigatorNote(link: string): Promise<boolean> {
    try {
      if (!(await this.ensureLocal(link))) {
        new Notice("Couldn't load that page. Check the family server connection and try again.");
        return false;
      }
      const [base, fragment] = link.split('#');
      const path = this.vaultSync.pathFor(base!);
      const file = this.app.metadataCache.getFirstLinkpathDest(base!, '')
        ?? this.app.vault.getAbstractFileByPath(path ?? base!);
      if (!(file instanceof TFile)) {
        new Notice("That page is still loading. Please tap it again in a moment.");
        return false;
      }
      if (file.path.startsWith(LIBRARY_PREFIX) && !file.path.startsWith(CANONICAL_PREFIX)
        && !file.path.startsWith(ANNOTATED_PREFIX) && !isSupplementalPage(file.path)) {
        if (docKindFor(file.path)) await this.openDoc(file);
        else this.openLibrarySheet(file, fragment ?? null);
      } else {
        await this.app.workspace.openLinkText(file.path + (fragment ? `#${fragment}` : ''), '');
      }
      return true;
    } catch {
      new Notice("Couldn't open that page. Please try again.");
      return false;
    }
  }

  /** 📖 The Library PAGE — Gospel Library's whole-screen architecture. */
  private openNavigator(): void {
    this.openLibraryShelf(v => v.showHome());
  }

  /** 🕸 The Graphs shelf — pre-filtered graph views, straight from the palette. */
  private openGraphPresets(): void {
    this.openLibraryShelf(v => v.showGraphs());
  }

  /** land on the Library page (reusing it if it is open) and jump to a shelf */
  /** the Library replaces the CURRENT page with that page behind it in
   * history — never a jump to an older Library tab (which has nothing
   * behind it and leaves ‹ dead) */
  private openLibraryShelf(show: (v: SGLibraryView) => void): void {
    closeMobileSidebars(this.app);
    void (async () => {
      const leaf = this.app.workspace.getLeaf(false);
      if (leaf.view.getViewType() !== LIBRARY_VIEW) {
        recordHistory(leaf);
        await leaf.setViewState({ type: LIBRARY_VIEW, active: true });
      }
      await this.app.workspace.revealLeaf(leaf);
      show(leaf.view as SGLibraryView);
      this.dock?.refresh();
    })();
  }

  /** Every bookmark; its footer reaches Continue, notebooks, flashcards and trails when the dock is on. */
  private openBookmarkList(): void {
    new BookmarksModal(this.app, this.study, this.dock ? () => this.dock?.openSaved() : null).open();
  }

  private currentBookmarkPage(): { file: TFile; container: HTMLElement } | null {
    const view = this.app.workspace.activeLeaf?.view;
    if (!view || !['markdown', DOC_VIEW, READER_VIEW].includes(view.getViewType())) return null;
    const state = view.getState() as { file?: string; path?: string; chapter?: string };
    const path = state.file ?? state.path;
    const file = path ? this.app.vault.getAbstractFileByPath(path)
      : state.chapter ? this.app.metadataCache.getFirstLinkpathDest(state.chapter, CANONICAL_PREFIX) : null;
    return file instanceof TFile ? { file, container: view.containerEl } : null;
  }

  private async openLessonDocument(path: string): Promise<boolean> {
    const file = this.app.metadataCache.getFirstLinkpathDest(path, '') ?? this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return false;
    const folder = lessonRoot(file.path);
    if (!folder) return false;
    closeMobileSidebars(this.app);
    await this.openDoc(file);
    return true;
  }

  /** Remember where the reader is — powers Continue + the Recent row. */
  private recordLastChapter(f: TFile): void {
    let title: string | null = null;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
      title = f.basename.slice(0, -" - My Notes".length);
    } else if (f.path.startsWith(CANONICAL_PREFIX) || (isSupplementalPage(f.path) && supplementalChapterNumber(f.basename) !== null)) {
      title = f.basename;
    }
    const slug = title ? chapterIdFromTitle(title) : null;
    if (!title || !slug) return;
    const d = this.state.device;
    if (d.lastChapter?.slug === slug) return;
    d.lastChapter = { slug, title };
    d.recentChapters = [{ slug, title, at: new Date().toISOString() },
      ...(d.recentChapters ?? []).filter(r => r.slug !== slug)].slice(0, 8);
    void this.state.saveDevice();
  }

  /** AI Library content floats over the reading page instead of replacing
   * it. The ↗ open-as-page path exists only in power mode (the same toggle
   * that shows the AI Library folder) — for the family it simply isn't there. */
  openLibrarySheet(file: TFile, subpath: string | null): void {
    if (isSupplementalPage(file.path)) {
      if (supplementalChapterNumber(file.basename) !== null && !subpath) { void this.openKeyboardChapter(file.basename); return; }
      void this.app.workspace.getLeaf(false).openFile(file, { state: { mode: 'preview' } });
      return;
    }
    // a hard question or a talk is the thing being read, not a glance at
    // it: its own page, with the reader's treatment
    if (docKindFor(file.path)) { void this.openDoc(file); return; }
    const openAsPage = this.state.device.showAiLibrary
      ? (f: TFile) => { void this.app.workspace.getLeaf().openFile(f); }
      : null;
    void this.timelineSubjects();   // warm the cache for the sync lookup
    new LibraryPreviewModal(this.state, file, subpath, openAsPage, {
      subjectFor: (name) => this.tlSubjects?.get(name.toLowerCase()) ?? null,
      focus: (subject) => void this.openTimelineFocus(subject),
    }).open();
  }

  /** An AI Library page (other than scripture) just opened as a PAGE — bounce
   * back to where the reader was and float the content as a sheet instead.
   * This is the safety net under every routing rule: it doesn't matter how
   * the page was reached. Power mode (showAiLibrary) disables the bounce. */
  private bounceAiPage(f: TFile): boolean {
    if (this.bouncing) return false;
    if (this.state.device.showAiLibrary) return false;
    if (!f.path.startsWith(LIBRARY_PREFIX)) return false;
    if (isSupplementalPage(f.path)) return false;
    if (f.path.startsWith(CANONICAL_PREFIX)
      || f.path.startsWith(ANNOTATED_PREFIX)) return false;
    this.bouncing = true;
    const ret = this.lastReadingPath
      ? this.app.vault.getAbstractFileByPath(this.lastReadingPath) : null;
    const home = ret instanceof TFile ? ret
      : this.app.metadataCache.getFirstLinkpathDest("Study Hub", "");
    const leaf = this.app.workspace.getLeaf();
    const nav: Promise<unknown> = home instanceof TFile
      ? leaf.openFile(home)
      : leaf.setViewState({ type: "empty" });
    void nav.catch(() => { /* the sheet still opens */ }).finally(() => {
      this.bouncing = false;
      this.openLibrarySheet(f, null);
    });
    return true;
  }

  /** Scripture pages must not FEEL like a second library: the tab header's
   * folder breadcrumb ("AI Library / 01 Scriptures / …") disappears there,
   * leaving just the page name. */
  private updateViewChrome(f: TFile): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || view.file?.path !== f.path) return;
    const scripture = f.path.startsWith(CANONICAL_PREFIX)
      || isSupplementalPage(f.path)
      || f.path.startsWith(ANNOTATED_PREFIX)
      || (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes"));
    view.containerEl.toggleClass("sg-clean-header", scripture);
    view.containerEl.toggleClass('sg-supplemental-page', isSupplementalPage(f.path));
    // Sidebar gesture opt-out lives on the whole mobile workspace; it is
    // independent of the optional chapter-turn gesture.
  }

  /** After following a link away from a chapter, one labeled tap returns. */
  private updateBackPill(f: TFile): void {
    const isReading = (f.path.startsWith(CANONICAL_PREFIX) && !!chapterIdFromTitle(f.basename))
      || (isSupplementalPage(f.path) && supplementalChapterNumber(f.basename) !== null)
      || (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes"));
    if (isReading) {
      this.lastReadingPath = f.path;
      document.body.removeClass("sg-back-on");
      return;
    }
    const target = this.lastReadingPath;
    const show = !!target && target !== f.path
      && !!this.app.vault.getAbstractFileByPath(target);
    if (show && this.backPillEl) {
      const base = target!.split("/").pop()!.replace(/\.md$/, "").replace(/ - My Notes$/, "");
      this.backPillEl.setText(`‹ ${base}`);
    }
    document.body.toggleClass("sg-back-on", show);
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
      if (dest && (dest.path.startsWith(CANONICAL_PREFIX) || isSupplementalPage(dest.path))) target = dest;
    }
    if (!target && (f.path.startsWith('AI Library/') || f.path.startsWith(PERSONAL_PREFIX))) target = f;
    if (!target) return;
    try {
      const { matchScene } = await import("./study/presence");
      const slug = (this.app.metadataCache.getFileCache(target)?.frontmatter as
        { slug?: string } | undefined)?.slug;
      const text = `# ${target.basename}\n` + await this.app.vault.cachedRead(target);
      const id = matchScene(text, slug);
      this.scenes.apply(id);
      if (this.state.device.lastMatchedScene !== id) {
        this.state.device.lastMatchedScene = id;
        void this.state.saveDevice();
      }
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
    menu.addItem(i => i.setTitle("📖 Match this page — setting & subject")
      .onClick(() => set("match", "match the chapter")));
    menu.addSeparator();
    for (const s of SCENES) {
      menu.addItem(i => i.setTitle(`${s.emoji} ${s.name}`)
        .onClick(() => set(s.id, s.name)));
    }
    menu.addSeparator();
    menu.addItem(i=>i.setTitle('Scene storage & offline favorites').onClick(()=>{
      if(this.scenes.cache)new SceneStorageModal(this.app,this.scenes.cache,()=>this.state.device.sceneCacheMB??100,async mb=>{this.state.device.sceneCacheMB=mb;await this.state.saveDevice();}).open();
    }));
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
    if (!view || view.file?.path !== f.path) return;
    if (!Platform.isMobile && !view.containerEl.querySelector(".sg-header-ai")) {
      const ask = view.addAction("sparkles", "Ask AI", () => {
        const cur = view.file;
        if (cur) void this.openAsk(cur.basename, null);
      });
      ask.addClass("sg-header-ai");
      ask.createSpan({ text: "AI" });
      this.register(() => ask.remove());
    }
    if (this.studyActionViews.has(view)) return;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
      this.studyActionViews.add(view);
      // feather, NOT a pencil — Obsidian's own edit toggle is already a
      // pencil and two identical icons side by side read as a bug
      view.addAction("feather", "Write in my notes", () => {
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
    // fast page-turns can race the first attempts — keep trying briefly
    window.setTimeout(flip, 150);
    window.setTimeout(flip, 500);
    window.setTimeout(flip, 1100);
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
      const canonical = path.startsWith(CANONICAL_PREFIX) || isSupplementalPage(path);
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
    const active = this.app.workspace.activeLeaf?.view;
    const pageState = active?.getState() as { path?: string; chapter?: string; view?: { kind?: string; path?: string; document?: string } } | undefined;
    if (!chapterTitle && active?.getViewType() === READER_VIEW) chapterTitle = pageState?.chapter ?? null;
    const library = active?.getViewType() === LIBRARY_VIEW;
    const sharedLesson = active?.getViewType() === SHARED_LESSON_VIEW;
    const project = library && pageState?.view?.kind === 'work' && pageState.view.path
      ? pageState.view.document ?? lessonProject(this.app, pageState.view.path).primary?.path ?? projectDocument(pageState.view.path, this.app.vault.getMarkdownFiles().map(file => file.path)) : null;
    const target = project ?? (chapterTitle ? this.app.metadataCache.getFirstLinkpathDest(chapterTitle, '')?.path ?? chapterTitle : null)
      ?? (!library ? pageState?.path ?? this.app.workspace.getActiveFile()?.path : null) ?? null;
    {
      const leaf = this.app.workspace.getLeavesOfType(ASK_VIEW)[0] ?? this.app.workspace.getRightLeaf(false);
      if (!leaf) return;
      if (!(leaf.view instanceof AskView)) await leaf.setViewState({ type: ASK_VIEW, active: false });
      this.app.workspace.rightSplit.collapse();
      if (leaf.view instanceof AskView) {
        leaf.view.setAnchor(chapterTitle ?? target?.split('/').pop()?.replace(/\.md$/, '') ?? null, verseId, seed);
        leaf.view.openOverlay(sharedLesson ? null : target, sharedLesson);
      }
      return;
    }
  }

  /** 📄 a question or talk as its own page (one history step, like the reader) */
  async openDoc(file: TFile): Promise<void> {
    void this.matchSceneToChapter(file);
    const leaf = (lessonRoot(file.path) || file.path.startsWith(`${LIBRARY_PREFIX}05 Events/`)) ? this.app.workspace.getLeaf(false) : this.app.workspace.getLeavesOfType(DOC_VIEW)[0]
      ?? this.app.workspace.getLeaf(false);
    recordHistory(leaf);
    await leaf.setViewState({ type: DOC_VIEW, state: { path: file.path }, active: true });
    await this.app.workspace.revealLeaf(leaf);
    document.body.addClass("sg-fab-on");   // the 📖 door out is always there
  }

  async openReader(title: string): Promise<void> {
    // one setViewState carrying the chapter = one clean history step, so
    // the back arrow retraces chapter → chapter → … → root navigator
    const leaf = this.app.workspace.getLeavesOfType(READER_VIEW)[0]
      ?? this.app.workspace.getLeaf(false);
    recordHistory(leaf);
    await leaf.setViewState({ type: READER_VIEW, state: { chapter: title }, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  private async ensureLeaf(type: string, where: "right" | "tab"): Promise<WorkspaceLeaf | null> {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    if (existing) return existing;
    const leaf = where === "right"
      ? this.app.workspace.getRightLeaf(false)
      : this.app.workspace.getLeaf(false);   // in-place, not a fresh tab
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
