/** ⌂ The dock — Gospel Library's bottom bar, done for this vault.
 *
 * GL's bar is five fixed doors (Home · Library · Search · Bookmarks · Tabs)
 * and a round audio button floating beside it. Obsidian's own mobile navbar
 * is a browser toolbar (‹ › search + tabs ☰): built for notes, not for
 * reading. This replaces it on phones with the same five doors, and goes a
 * little further:
 *   - ‹ appears only when the current tab has somewhere to go back to, and
 *     walks the same history the pages record (leafNav) — one bar, no
 *     dead arrows.
 *   - 🎧 Listen reads the open chapter aloud with the phone's own voice;
 *     tap again to stop.
 *   - long-press Tabs for tab management, long-press Home for Obsidian's
 *     ribbon menu — the two things the old bar had that this one folds away.
 * Everything here calls surfaces that already exist; the dock is a door,
 * not a room. */
import { App, Modal, Notice, Platform, TFile, TFolder, requestUrl, type EventRef } from "obsidian";
import { chapterIdFromTitle, parseCanonicalVerses, parseFrontmatter } from "@scripture-graph/core-sdk";
import type { Annotation } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, PERSONAL_PREFIX, SGState } from "../state";
import { historyBack } from "./leafNav";
import { NotebookModal, exportJournal, notebooks } from "./notebooks";
import { releaseKeyboard } from "./libraryView";
import { trace } from "./trace";
import { isTalk } from "./youtubeFind";
import { familyStoryId } from './familyNarration';
import type { BookmarkControls } from './bookmarkControls';

export interface DockHost {
  openHome: () => void;
  openLibrary: () => void;
  openSearch: () => void;
  /** My highlights & notes; optional so older hosts still mount the dock */
  openMarks?: () => void;
  openAsk: () => void;
  openTabs: () => void;
  tabsMenu: (evt: MouseEvent) => void;
  ribbonMenu: (evt: MouseEvent) => void;
  reviewFlashcards: () => void;
  openPath: (path: string) => void;
  /** the page under the dock right now (a note, or a page view's file) */
  currentPage: () => TFile | null;
  bookmarkControls: BookmarkControls;
  /** every bookmark (holding the bookmark button, or tapping it on a shelf) */
  openBookmarks: () => void;
  bookmarkOf: (file: TFile) => Promise<Annotation | null>;
  bookmark: (file: TFile) => Promise<void>;
  unbookmark: (a: Annotation) => Promise<void>;
  /** this week's Come Follow Me key, for the Home badge */
  currentCfmWeek: () => Promise<string | null>;
  /** play this page's video (a talk's YouTube version) in the corner
   * window; false when the page has none */
  playVideo?: (file: TFile) => Promise<boolean>;
  /** the video window: playing, paused, or nothing */
  videoState?: () => "playing" | "paused" | null;
  toggleVideo?: () => void;
  listenFamily?: (file: TFile) => Promise<void>;
  familyAudioState?: (file: TFile | null) => 'playing' | 'paused' | null;
  openNote: (link: string) => void;
}

interface ObsidianInternals {
  mobileTabSwitcher?: { show: () => void; showTabManagementMenu: (e: MouseEvent) => void };
  mobileNavbar?: { showRibbonMenu: (e: MouseEvent) => void; tabButtonEl?: HTMLElement };
}

/** Obsidian's own tab switcher / ribbon menu, when the build exposes them */
export function obsidianInternals(app: App): ObsidianInternals {
  return app as unknown as ObsidianInternals;
}

export class Dock {
  private el: HTMLElement | null = null;
  private backBtn: HTMLElement | null = null;
  private tabsCount: HTMLElement | null = null;
  private homeBadge: HTMLElement | null = null;
  private slots = new Map<string, HTMLElement>();
  private listen = new Listener();
  private listenBtn: HTMLElement | null = null;
  private drawerObserver: MutationObserver | null = null;
  private drawerEvent: EventRef | null = null;
  private drawerFrame = 0;

  private syncDrawerVisibility = () => {
    const ws = this.s.app.workspace;
    const open = Platform.isMobile && (!ws.leftSplit.collapsed || !ws.rightSplit.collapsed);
    this.el?.toggleClass("sg-dock-sidebar-open", open);
  };

  private scheduleDrawerVisibility = () => {
    cancelAnimationFrame(this.drawerFrame);
    this.drawerFrame = requestAnimationFrame(this.syncDrawerVisibility);
  };

  constructor(private s: SGState, private host: DockHost) {}

  mount(): void {
    if (this.el) return;
    const el = document.body.createDiv({ cls: "sg-dock" });
    const bar = el.createDiv({ cls: "sg-dock-bar" });
    this.backBtn = this.slot(bar, "back", "‹", "Back", () => {
      const leaf = this.s.app.workspace.activeLeaf;
      if (!leaf || !historyBack(leaf)) this.host.openHome();
    });
    this.backBtn.addClass("sg-dock-back");
    const home = this.slot(bar, "home", ICON.home, "Home", () => this.host.openHome());
    longPress(home, e => this.host.ribbonMenu(e));
    this.homeBadge = home.createSpan({ cls: "sg-dock-dot" });
    this.slot(bar, "library", ICON.library, "Library", () => this.host.openLibrary());
    this.slot(bar, "search", ICON.search, "Search", () => this.host.openSearch());
    this.slot(bar, "ai", ICON.ai, "Ask AI", () => this.host.openAsk());
    const bookmark = this.slot(bar, "saved", ICON.saved, "Bookmark this page", () => void this.host.bookmarkControls.toggle());
    this.host.bookmarkControls.mountButton(bookmark as HTMLButtonElement, () => this.host.openBookmarks());
    const tabs = this.slot(bar, "tabs", ICON.tabs, "Tabs", () => this.host.openTabs());
    this.tabsCount = tabs.createSpan({ cls: "sg-dock-count" });
    longPress(tabs, e => this.host.tabsMenu(e));
    this.listenBtn = el.createEl("button", { cls: "sg-dock-round", attr: { "aria-label": "Listen" } });
    this.listenBtn.innerHTML = ICON.listen;
    this.listenBtn.onclick = () => this.toggleListen();
    this.el = el;
    document.body.addClass("sg-dock-on");
    document.addEventListener("sg-dock-refresh", this.onRefresh);
    if (Platform.isMobile) {
      const ws = this.s.app.workspace;
      this.drawerEvent = ws.on("layout-change", this.scheduleDrawerVisibility);
      this.drawerObserver = new MutationObserver(this.scheduleDrawerVisibility);
      // Swipe transitions can change drawer styles without a layout event.
      // The dock is outside this container, so updating it cannot retrigger this observer.
      this.drawerObserver.observe(ws.containerEl, { attributes: true, subtree: true, attributeFilter: ["class", "style"] });
    }
    this.syncDrawerVisibility();
    this.refresh();
  }

  private onRefresh = () => this.refresh();

  /** Continue reading, notebooks, flashcards and trails (reached from Bookmarks). */
  openSaved(): void { new SavedModal(this.s, this.host).open(); }

  unmount(): void {
    this.host.bookmarkControls.unmountButton();
    document.removeEventListener("sg-dock-refresh", this.onRefresh);
    this.drawerObserver?.disconnect();
    this.drawerObserver = null;
    if (this.drawerEvent) this.s.app.workspace.offref(this.drawerEvent);
    this.drawerEvent = null;
    cancelAnimationFrame(this.drawerFrame);
    this.listen.stop();
    this.el?.remove();
    this.el = null;
    document.body.removeClass("sg-dock-on");
  }

  /** what is lit, whether ‹ has anywhere to go, how many tabs */
  refresh(): void {
    if (!this.el) return;
    void this.host.bookmarkControls.refresh();
    this.syncDrawerVisibility();
    try {
      const ws = this.s.app.workspace;
      const leaf = ws.activeLeaf;           // may be null before the first page
      const type = leaf?.view?.getViewType?.() ?? "";
      const h = (leaf as unknown as { history?: { backHistory?: unknown[] } } | null)?.history;
      this.backBtn?.toggleClass("sg-dock-back-on", !!h?.backHistory?.length);
      const f = ws.getActiveFile();
      const lib = leaf?.view as { dockSlot?: () => string } | undefined;
      const lit = type === "scripture-graph-ask" ? "ai" : type === "sg-library" ? (lib?.dockSlot?.() ?? "library")
        : type === "markdown" && !!f && f.path.startsWith(PERSONAL_PREFIX) && f.basename === "Study Hub" ? "home" : "";
      for (const [k, b] of this.slots) b.toggleClass("sg-dock-on-slot", k === lit);
      let n = 0;
      ws.iterateRootLeaves(() => { n++; });
      if (this.tabsCount) this.tabsCount.setText(n > 1 ? String(n) : "");
      // new since last seen: a fresh Did-you-notice day, or a new Come Follow Me week
      const seen = (this.s.device.seen ?? {});
      const day = Math.floor(Date.now() / 86_400_000);
      void this.host.currentCfmWeek().then(week => {
        const fresh = (seen.insightDay !== day) || (!!week && seen.cfmWeek !== week);
        this.homeBadge?.toggleClass("sg-dock-dot-on", fresh && lit !== "home");
      });
      const page = this.host.currentPage();
      const video = this.host.videoState?.() ?? null;
      this.listenBtn?.toggleClass("sg-dock-round-on", this.listen.playing || video === "playing"
        || this.host.familyAudioState?.(page) === 'playing');
      this.listenBtn?.toggleClass("sg-dock-round-off",
        !familyStoryId(this.s.app, page) && !this.listen.canRead(this.s.app, page) && !(page && isTalk(this.s.app, page)) && !video);
    } catch (e) {
      console.warn("scripture-graph: dock refresh", e);
    }
  }

  private slot(bar: HTMLElement, key: string, icon: string, label: string, onTap: () => void): HTMLElement {
    const b = bar.createEl("button", { cls: `sg-dock-slot sg-dock-${key}`, attr: { "aria-label": label, title: label } });
    b.innerHTML = icon;
    b.onclick = (e) => { e.preventDefault(); releaseKeyboard(); trace("dock.tap", { key }); onTap(); };
    this.slots.set(key, b);
    return b;
  }

  /** 🎧: a talk plays its YouTube version in the corner window (tap again
   * to pause, again to resume); a chapter is read aloud; anything else with
   * a Church recording streams it */
  private toggleListen(): void {
    const page = this.host.currentPage();
    if (page && familyStoryId(this.s.app, page) && this.host.listenFamily) {
      this.listen.stop();
      void this.host.listenFamily(page).finally(() => this.refresh());
      return;
    }
    if (this.listen.playing) { this.listen.stop(); this.refresh(); return; }
    if (this.host.videoState?.() === "playing") { this.host.toggleVideo?.(); this.refresh(); return; }
    if (page && this.host.playVideo && isTalk(this.s.app, page)) {
      const finding = new Notice("Finding the video…", 0);
      void this.host.playVideo(page).then(ok => {
        finding.hide();
        if (!ok) {
          // no video to be found: the Church's recording, when there is one
          if (!this.listen.start(this.s.app, page)) new Notice("No video or recording for this talk");
        }
        this.refresh();
      });
      return;
    }
    if (this.host.videoState?.() === "paused") { this.host.toggleVideo?.(); this.refresh(); return; }
    const ok = this.listen.start(this.s.app, page);
    if (!ok) new Notice("Open a chapter or a talk to listen to it");
    this.refresh();
  }
}

/** a press held ~450 ms — the way GL and Obsidian both hide their menus */
function longPress(el: HTMLElement, fn: (e: MouseEvent) => void): void {
  let t: number | null = null;
  const start = (e: PointerEvent) => {
    t = window.setTimeout(() => { t = null; fn(e as unknown as MouseEvent); }, 450);
  };
  const cancel = () => { if (t !== null) { window.clearTimeout(t); t = null; } };
  el.addEventListener("pointerdown", start);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("contextmenu", e => { e.preventDefault(); fn(e); });
}

// ------------------------------------------------------------- 🎧 listen

/** the open chapter read aloud by the system voice (Web Speech). No
 * download, no account, works offline on iOS/Android; stops on navigation. */
class Listener {
  playing = false;
  private utter: SpeechSynthesisUtterance | null = null;

  /** the chapter behind the open page: canonical, or the My Notes twin */
  private text(app: App): { title: string; file: TFile } | null {
    const f = app.workspace.getActiveFile();
    if (!f) return null;
    let file: TFile | null = f;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
      const dest = app.metadataCache.getFirstLinkpathDest(f.basename.replace(/ - My Notes$/, ""), "");
      if (dest?.path.startsWith(CANONICAL_PREFIX)) file = dest;
    }
    if (!file || !file.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(file.basename)) return null;
    return { title: file.basename, file };
  }

  private audio: HTMLAudioElement | null = null;

  /** a Church study page's API uri, from the note's url — talks, Teachings
   * chapters, Come Follow Me lessons all answer with their recording */
  private churchUri(app: App, f: TFile | null): string | null {
    if (!f) return null;
    const fm = (app.metadataCache.getFileCache(f)?.frontmatter ?? {}) as Record<string, unknown>;
    const url = typeof fm["url"] === "string" ? fm["url"] : "";
    const m = /^https?:\/\/www\.churchofjesuschrist\.org(?:\/study)?(\/[^?#]+)/.exec(url);
    return m ? m[1]! : null;
  }

  canRead(app: App, page: TFile | null = null): boolean {
    if (this.churchUri(app, page)) return true;
    return typeof window !== "undefined" && "speechSynthesis" in window && this.text(app) !== null;
  }

  /** the recording behind a Church page, when the API offers one */
  private async recording(uri: string): Promise<string | null> {
    try {
      const res = await requestUrl({
        url: `https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=${encodeURIComponent(uri)}`,
        headers: { "User-Agent": "ScriptureGraph-personal-study/0.1" },
      });
      const audio = (res.json?.meta?.audio ?? []) as { mediaUrl?: string; variant?: string }[];
      const pick = audio.find(a => a.mediaUrl && !/ACCOMPANIMENT/i.test(a.variant ?? "")) ?? audio.find(a => a.mediaUrl);
      return pick?.mediaUrl ?? null;
    } catch { return null; }
  }

  start(app: App, page: TFile | null = null): boolean {
    const uri = this.churchUri(app, page);
    if (uri && page) {
      // the speaker's own voice, streamed from the Church
      this.playing = true;
      document.body.addClass("sg-listening");
      void this.recording(uri).then(url => {
        if (!this.playing) return;
        if (!url) {
          this.playing = false;
          document.body.removeClass("sg-listening");
          new Notice("No recording for this page");
          return;
        }
        this.audio?.pause();
        this.audio = new Audio(url);
        const done = () => { this.playing = false; this.audio = null; document.body.removeClass("sg-listening"); };
        this.audio.onended = done;
        this.audio.onerror = () => done();
        void this.audio.play();
        trace("listen.recording", { page: page.basename });
      });
      return true;
    }
    const t = this.text(app);
    if (!t || !("speechSynthesis" in window)) return false;
    void app.vault.cachedRead(t.file).then(raw => {
      const { body } = parseFrontmatter(raw);
      const verses = parseCanonicalVerses(body);
      const speech = [t.title, ...verses.map(v => `${v.verse}. ${v.text}`)].join("\n");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(speech);
      u.rate = 0.96;
      u.onend = () => { this.playing = false; this.utter = null; document.body.removeClass("sg-listening"); };
      u.onerror = u.onend;
      this.utter = u;
      this.playing = true;
      document.body.addClass("sg-listening");
      window.speechSynthesis.speak(u);
      trace("listen.start", { chapter: t.title, verses: verses.length });
    });
    return true;
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.playing = false;
    this.utter = null;
    document.body.removeClass("sg-listening");
  }
}

// ------------------------------------------------------------- 🔖 saved

/** recent chapters, notebooks, flashcards due, study trails — one sheet (bookmarks have their own) */
class SavedModal extends Modal {
  constructor(private s: SGState, private host: DockHost) { super(s.app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-saved");
    c.createEl("h2", { text: "Continue & study" });
    const all = await this.s.sync.allAnnotations();
    const due = all.filter(a => {
      if (a.deleted_at || a.annotation_type !== "study-marker") return false;
      try { return (JSON.parse(a.content) as { card: { due: string } }).card.due <= new Date().toISOString(); }
      catch { return false; }
    }).length;

    const sect = (label: string) => c.createDiv({ cls: "sg-nav-sect", text: label });
    const row = (parent: HTMLElement, icon: string, name: string, sub: string, onTap: () => void,
      onRemove?: () => void) => {
      const r = parent.createDiv({ cls: "sg-nav-row" });
      r.setAttr("role", "button");
      r.setAttr("tabindex", "0");
      r.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); r.click(); } };
      r.createSpan({ cls: "sg-saved-ico", text: icon });
      const col = r.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: name });
      if (sub) col.createDiv({ cls: "sg-nav-gsub", text: sub });
      r.onclick = () => { this.close(); onTap(); };
      if (onRemove) {
        // ✕ removes without leaving the sheet
        const x = r.createEl("button", { cls: "sg-saved-x", text: "✕" });
        x.setAttr("aria-label", "Remove bookmark");
        x.onclick = (e) => { e.stopPropagation(); onRemove(); r.remove(); };
      }
    };

    if (this.host.openMarks) {
      const marks = c.createDiv({ cls: "sg-nav-list" });
      row(marks, "🖍", "My highlights & notes", "Every mark you have made, in one place", () => this.host.openMarks!());
    }

    sect("Continue");
    const recent = this.s.device.recentChapters ?? [];
    const list0 = c.createDiv({ cls: "sg-nav-list" });
    if (!recent.length) list0.createDiv({ cls: "sg-nav-empty", text: "Nothing read yet." });
    for (const r of recent.slice(0, 4)) {
      row(list0, "📖", r.title, new Date(r.at).toLocaleDateString(),
        () => this.host.openPath(`${r.title} - My Notes`));
    }

    const nbs = await notebooks(this.s);
    if (nbs.length) {
      sect("Notebooks");
      const list4 = c.createDiv({ cls: "sg-nav-list" });
      for (const nb of nbs) {
        row(list4, nb.emoji, nb.title, `${nb.entries.length} entr${nb.entries.length === 1 ? "y" : "ies"}`,
          () => new NotebookModal(this.s, nb, l => this.host.openNote(l)).open());
      }
      row(list4, "📤", "Export the journal", "One page in Library/ with everything, by theme", () => void (async () => {
        const md = await exportJournal(this.s.app, this.s);
        const path = "Library/Study Journal.md";
        const f = this.s.app.vault.getAbstractFileByPath(path);
        if (f instanceof TFile) await this.s.app.vault.modify(f, md); else await this.s.app.vault.create(path, md);
        this.host.openNote("Study Journal");
      })());
    }

    sect("Flashcards");
    const list2 = c.createDiv({ cls: "sg-nav-list" });
    row(list2, "🃏", due ? `${due} card${due === 1 ? "" : "s"} due` : "Nothing due", "Review with spaced repetition",
      () => this.host.reviewFlashcards());

    const trails = this.s.app.vault.getAbstractFileByPath(`${PERSONAL_PREFIX}Study Trails`);
    if (trails instanceof TFolder && trails.children.length) {
      sect("Study trails");
      const list3 = c.createDiv({ cls: "sg-nav-list" });
      for (const f of trails.children.slice(0, 20)) {
        if (f instanceof TFile) row(list3, "👣", f.basename, "", () => this.host.openPath(f.path));
      }
    }
  }

  onClose(): void { this.contentEl.empty(); }
}

// ------------------------------------------------------------- icons (GL's line style)
const ICON = {
  ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/><path d="M20 2v4M18 4h4"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg>`,
  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="4" height="16" rx="0.8"/><rect x="9.5" y="4" width="4" height="16" rx="0.8"/><path d="m15.5 5.2 3.9-.9 3.1 14.6-3.9.9z"/><path d="M3.5 8h4M9.5 8h4"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="m15.5 15.5 5 5"/></svg>`,
  saved: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>`,
  tabs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="7" y="7" width="13" height="13" rx="2"/><path d="M4 15V6a2 2 0 0 1 2-2h9"/></svg>`,
  listen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v5a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2z"/><path d="M20 13v5a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2z"/></svg>`,
};

export const isPhone = (): boolean => Platform.isMobile;
