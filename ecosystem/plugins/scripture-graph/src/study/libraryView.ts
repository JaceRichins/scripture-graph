import { renderRemoteSearch } from './remoteSearch';
import { renderAtlas } from './atlas/maps';
import timelineBackground from '../assets/timeline-background.jpg';
import { addLessonPrintItem, addPrintItems } from '../printing/printMenu';
import { ENOCH_VOLUME, renderEnochChapters } from './enoch';
import { COMMANDMENTS_VOLUME, renderCommandmentsChapters } from './commandments';
import { familyViewer, relevantFamilyPeople, relevantFamilyStories, type FamilySpouse } from './familyRelations';
import { familyEntries, renderFamilyLibrary } from './familyLibrary';
/** 🏛 The Library PAGE — Gospel Library's architecture, our craft.
 *
 * Not a modal anymore: a full workspace view, the way Gospel Library's
 * Library tab owns the whole screen. Top-down: a big left-aligned title
 * with a back chevron when drilled, the smart search, the Continue hero,
 * then the SHELF — a grid of cover cards with the stacked-deck lines GL
 * puts above each one. The Scriptures cover is the photo's black jacket
 * with the four works gold-stamped down its front; it drills to the five
 * volume covers, then books, then the chapter grid — GL's exact rhythm. */
import { ItemView, Menu, Notice, Platform, TFile, WorkspaceLeaf, type ViewStateResult } from "obsidian";
import { BOOKS, type BookInfo } from "@scripture-graph/core-sdk";
import { LIBRARY_PREFIX, SGState } from "../state";
import { type MusicPlayer, type PlayItem } from "./music";
import { historyBack, recordHistory, refreshNavArrows } from "./leafNav";
import { GRAPH_PRESETS, openGraphPreset } from "./graphPresets";
import { cascade, iconHue, navIcon, type NavIconName } from "./navIcons";
import { LIBRARY_SECTIONS, VOLUMES, titleForChapterSlug, type NavigatorHost } from "./navigator";
import { renderMyMarks, type MarkKind } from "./myMarks";
import { SEARCH_SCOPES, VOLUMES as SEARCH_VOLUMES, filterLocal, keepHit, rememberSearch, type SearchScope, type Volume } from "./searchFilters";
import { buildSearchIndex, parseReference, searchIndexReady, smartSearch, type SearchResults } from "./search";
import { AddSongModal, songsOn } from "./addSong";
import { FamilyTree, monthDay, relationLabel, type TreeNode, type TreeData } from "./familyTree";
import { lazyFetch } from "../sync/vaultSync";
import { familyInboxButton, FamilyInboxModal } from '../social/pageSharing';
import { researchSharing, sharedLessonsSection } from '../social/sharedLessons';
import { documentTitle, projectTitle } from '../ai/documentContext';
import { lessonRoot, projectKind } from '../ai/lessonProject';
import { renderLessonWorkspace, type LessonDestination } from '../ai/lessonWorkspace';
import { renderComeFollowMeShelf } from './comeFollowMeShelf';

interface StoryRow {
  id: string; title: string; words: number; chapters: number; grade: number; kind: string; themes: string[];
  hook: string; why: string; scripture: string; page: string; minutes: number;
  people: { pid: string; n: string; b?: string | null }[];
  audio?: { telling?: string; kids?: string; full?: string }; audioChapters?: string[];
}
import { BUNDLED_COVERS } from "../assets/covers";
import { CFM_MONTH_ART, coverKey, distinctCover, inheritedCoverKey } from './coverCatalog';
import { coverPhotoSources, mountCoverPhoto } from './coverPhoto';
import { BUILD } from "../build";
import { eventBackgrounds, renderEventBackgrounds } from './eventBackgrounds';
import { EventBackgroundPreview } from './eventBackgroundPreview';
import { SCENES } from './scenes';
import { photoLibrary, renderPhotoGallery, renderPhotoDetail, type PhotoGalleryState, type PhotoGalleryIO } from './photoGallery';
import { PHOTO_THUMBNAILS } from './photoThumbnails';

export const LIBRARY_VIEW = "sg-library";

type LibView =
  | { kind: "home" }
  | { kind: "scriptures" }
  | { kind: "books"; volume: string }
  | { kind: "chapters"; book: BookInfo }
  | { kind: "graphs" }
  | { kind: "maps" }
  | ({ kind: 'photos'; photo?: string } & PhotoGalleryState)
  | { kind: 'event-backgrounds'; query?: string; page?: number }
  | { kind: "work"; path?: string; resources?: boolean; document?: string }
  | { kind: "timelines" }
  | { kind: "questions" }
  | { kind: "hymns"; book?: string }
  | { kind: "music" }
  | { kind: "playlist"; key: string; title: string }
  | { kind: "folder"; path: string; title: string }
  | { kind: 'family'; query?: string }
  | { kind: 'family-stories'; query?: string }
  | { kind: 'family-people'; query?: string }
  | { kind: "family-tree" }
  | { kind: "marks"; mark?: MarkKind | "all"; query?: string; recent?: boolean };

/** blur whatever is focused inside `root` and tell the layout the keyboard
 * is gone — Obsidian sizes the mobile workspace from keyboard events, and a
 * focused input that is simply removed never sends one */
export function releaseKeyboard(root: HTMLElement | null = null): void {
  const ae = document.activeElement;
  if (ae instanceof HTMLElement && (!root || root.contains(ae)) && ae !== document.body) {
    ae.blur();
    window.setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
  }
}

/** the Come, Follow Me week index the engine writes from the manual's TOC */
const CFM_PATH = "AI Library/00 System/Come Follow Me.md";
interface CfmWeek { week: string; start: string; end: string; dates: string; block: string;
  chapters: string[]; uri: string; page: string | null }

/** where the engine files a year's lessons */
const CFM_FOLDER = `${LIBRARY_PREFIX}07 Come Follow Me`;

/** the hymnbook index the engine writes (titles, numbers, the Church's recordings) */
const HYMNS_PATH = "AI Library/00 System/Hymns.md";
interface Hymn { uri: string; title: string; n: number | null; url: string; book?: string;
  audio?: { vocal?: string; accompaniment?: string; other?: string } }

/** the Music shelf's playlists (see the note's own header) */
const MUSIC_PATH = "AI Library/00 System/Music.md";
interface Track { t: string; a: string; yt?: string; url?: string; credit?: string; choir?: string; choir_when?: string;
  church?: string; church_when?: string; church_by?: string }
interface Playlist { key: string; title: string; blurb?: string; cover?: string; tracks: Track[] }

/** loose title match: "Abide with Me!" ~ "abide with me" */
function normTitle(t: string): string {
  return t.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
}

/** the Did-you-notice pool (see the note's own header) */
const INSIGHTS_PATH = "AI Library/00 System/Insights.md";

interface Insight {
  id: string; title: string; hook: string;
  refs: { label: string; chapter: string; anchor: string }[];
  read: string;
}

/** shelf cover photos (public-domain art; any file here can be replaced) */
const COVERS_PATH = "AI Library/00 System/covers";
const COVER_WINDOW = 24;
/** where the engine keeps the question pages (the MOC lives beside them) */
const QUESTIONS_PATH = "AI Library/50 Questions";
/** the four original seeds predate the `scope` field; their vault copies are
 * write-once, so the shelf files them by title */
const QUESTION_SCOPE_BY_TITLE: Record<string, string> = {
  "How reliable are the Book of Mormon witnesses": "book-of-mormon",
  "Is the Book of Mormon an ancient historical record": "book-of-mormon",
  "Why are there multiple First Vision accounts": "restoration",
  "How reliable is the biblical text": "christianity",
};

export class SGLibraryView extends ItemView {
  private view: LibView = { kind: "home" };
  private trail: LibView[] = [];
  private searchQuery = "";
  private searchTimer: number | null = null;
  private homeRefreshTimer: number | null = null;
  private catalogRefreshPending = false;
  private familyIndexLoads = new Map<string, Promise<TFile | null>>();
  private indexLoads = new Map<string, Promise<TFile | null>>();
  private searchSeq = 0;
  private groupActs: { group_name: string; chapter_slug: string; count: number; others: number }[] | null = null;

  constructor(leaf: WorkspaceLeaf, private s: SGState, private host: NavigatorHost) {
    super(leaf);
    // a PAGE, not a panel: opens replace this leaf and the tab's back
    // arrow returns here — only Obsidian's + button makes new tabs
    this.navigation = true;
  }

  getViewType(): string { return LIBRARY_VIEW; }
  getDisplayText(): string { return "Library"; }
  getIcon(): string { return "library"; }

  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    if (this.view.kind === 'work' && this.view.path) {
      const file = this.view.document ? this.app.vault.getAbstractFileByPath(this.view.document) : null;
      if (file instanceof TFile) addPrintItems(menu, this.app, file);
      else addLessonPrintItem(menu, this.app, this.view.path);
    }
  }

  /** The drilled-down place rides the leaf state, so the tab's back arrow
   * (and a page's ‹ Back) returns to WHERE you were in the Library — the
   * chapter list, the questions shelf, a conference year — not to the root.
   * Without this every history restore made a fresh view at home
   * (user-reported). A book is stored by slug: BookInfo is not state. */
  getState(): Record<string, unknown> {
    const pack = (v: LibView) => v.kind === "chapters" ? { kind: "chapters", book: v.book.slug } : v;
    return { view: pack(this.view), trail: this.trail.map(pack) };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    await super.setState(state, result);
    const st = state as { view?: unknown; trail?: unknown[] } | null;
    const unpack = (v: unknown): LibView | null => {
      if (!v || typeof v !== "object" || typeof (v as { kind?: unknown }).kind !== "string") return null;
      const o = v as { kind: string; book?: unknown; path?: unknown; title?: unknown; volume?: unknown };
      if (o.kind === "chapters") {
        const b = BOOKS.find(x => x.slug === o.book);
        return b ? { kind: "chapters", book: b } : { kind: "scriptures" };
      }
      // Old tabs and Back history must not restore the retired folder dump.
      if (o.kind === 'folder' && typeof o.path === 'string' && this.isLibraryRoot(o.path)) return { kind: 'scriptures' };
      return o as unknown as LibView;
    };
    const v = unpack(st?.view);
    if (v) {
      this.view = v;
      this.trail = (st?.trail ?? []).map(unpack).filter((x): x is LibView => !!x);
      if (this.contentEl.hasClass("sg-libpage")) this.render();
    }
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("sg-libpage");
    this.registerEvent(this.app.workspace.on('active-leaf-change', this.syncTimelineScene));
    this.registerEvent(this.app.metadataCache.on('changed', file => {
      if (this.view.kind !== 'work' || !lessonRoot(file.path)) return;
      if (this.view.path && lessonRoot(file.path) !== this.view.path) return;
      if (!this.contentEl.isConnected || document.activeElement?.matches('input, textarea')) return;
      this.render();
    }));
    this.app.workspace.onLayoutReady(this.syncTimelineScene);
    const identityKey = () => JSON.stringify([this.s.device.userId, this.s.device.displayName, this.s.device.familyPersonId, this.s.device.familySpouseId]);
    let identity = identityKey();
    const identityChanged = () => {
      const next = identityKey();
      if (next !== identity) { identity = next; this.catalogRefreshPending = true; this.scheduleHomeRefresh(); }
    };
    this.s.onChange.push(identityChanged);
    this.register(() => { this.s.onChange = this.s.onChange.filter(fn => fn !== identityChanged); });
    const homeFileChanged = (file: { path: string }) => {
      if (file.path === INSIGHTS_PATH) this.insightPool = null;
      if (file.path === HYMNS_PATH || file.path === MUSIC_PATH) this.catalogRefreshPending = true;
      if (file.path !== CFM_PATH && file.path !== INSIGHTS_PATH
        && file.path !== HYMNS_PATH && file.path !== MUSIC_PATH
        && !/(?:^|\/)Family (?:Stories|Tree)\.md$/.test(file.path)) return;
      this.scheduleHomeRefresh();
    };
    this.registerEvent(this.app.vault.on("create", homeFileChanged));
    this.registerEvent(this.app.vault.on("modify", homeFileChanged));
    const catalogChanged = () => {
      this.catalogRefreshPending = true;
      this.scheduleHomeRefresh();
    };
    document.addEventListener("sg-library-catalog-changed", catalogChanged);
    this.register(() => document.removeEventListener("sg-library-catalog-changed", catalogChanged));
    // the "‹ <chapter>" pill has a Continue card here already; off the title
    document.body.addClass("sg-lib-open");
    this.render();
    void this.host.refreshCatalog?.().catch(() => {
      if (!this.contentEl.isConnected) return;
      const retry = this.contentEl.createEl('button', { cls: 'sg-nav-dl', text: 'Library connection unavailable — tap to refresh available books' });
      retry.onclick = () => {
        retry.disabled = true;
        void this.host.refreshCatalog?.().then(() => retry.remove()).catch(() => { retry.disabled = false; });
      };
    });
  }

  /** Sync can finish after Home opens. Refresh only its source notes, and
   * never replace a focused input or an active search with a new page. */
  private scheduleHomeRefresh(): void {
    if (this.homeRefreshTimer !== null) window.clearTimeout(this.homeRefreshTimer);
    this.homeRefreshTimer = window.setTimeout(() => {
      this.homeRefreshTimer = null;
      const catalogView = this.catalogRefreshPending
        && ["scriptures", "folder", "family", "music", "hymns", "playlist"].includes(this.view.kind);
      if (this.view.kind === 'family' && this.view.query?.trim()) return;
      if ((this.view.kind !== "home" && !catalogView) || this.searchQuery.trim() || !this.contentEl.isConnected) return;
      if (document.activeElement?.matches("input, textarea, [contenteditable='true']")) {
        this.scheduleHomeRefresh();
        return;
      }
      this.catalogRefreshPending = false;
      this.render();
    }, 750);
  }

  async onClose(): Promise<void> {
    this.releaseTimelineScene();
    if (this.homeRefreshTimer !== null) window.clearTimeout(this.homeRefreshTimer);
    this.homeRefreshTimer = null;
    this.host.scene?.(null);
    for (const u of this.unsubs) u();          // the music keeps playing; only the rows stop listening
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    document.body.removeClass("sg-lib-open");
    this.contentEl.empty();
  }

  /** every drill-down is a history step: the tab's own back stack gets the
   * place being left (recordHistory), so the navbar's ‹ › arrows walk the
   * Library the way they walk notes — and the in-page ‹ walks the same
   * stack, so the two never disagree (user-reported: the arrows were dead
   * inside the Library, and ‹ went to the root) */
  private go(v: LibView): void {
    recordHistory(this.leaf);
    this.trail.push(this.view);
    this.view = v.kind === 'folder' && this.isLibraryRoot(v.path) ? { kind: 'scriptures' } : v;
    this.render();
    refreshNavArrows(this.app, this.leaf);
  }

  private back(): void {
    if (historyBack(this.leaf)) return;      // restores view + trail via setState
    const prev = this.trail.pop();
    if (prev) { this.view = prev; this.render(); return; }
    const v = this.view;
    this.view = v.kind === "chapters" ? { kind: "books", volume: v.book.volume }
      : v.kind === "books" ? { kind: "scriptures" }
        : { kind: "home" };
    this.render();
  }

  dockSlotHymns(): boolean { return this.view.kind === "hymns" || this.view.kind === "playlist"; }

  private title(): string {
    if (this.view.kind === 'work') {
      const research = projectKind(this.view.path ?? '') === 'research';
      return this.view.document ? (research ? 'Research' : 'Lesson') : this.view.resources ? (research ? 'Research pages' : 'Resources') : this.view.path ? projectTitle(this.app, this.view.path) : 'My Work';
    }
    if (this.view.kind === "hymns") return this.view.book === "Children's Songbook" ? "Children's Songs" : "Hymns";
    if (this.view.kind === "music") return "Music";
    if (this.view.kind === "playlist") return this.view.title;
    if (this.view.kind === 'event-backgrounds') return 'Event Backgrounds';
    if (this.view.kind === 'photos') return SCENES.find(s => s.id === (this.view as { photo?: string }).photo)?.name ?? 'Photos';
    if (this.view.kind === 'marks') return 'My highlights & notes';
    const v = this.view;
    return v.kind === "home" ? "Home"
      : v.kind === "scriptures" ? "Library"
        : v.kind === "books" ? v.volume
          : v.kind === "chapters" ? v.book.name
            : v.kind === "graphs" ? "Graphs"
              : v.kind === "maps" ? "Maps"
              : v.kind === "timelines" ? "Timelines"
                : v.kind === "questions" ? "Hard Questions"
                  : v.kind === "family" ? "Family"
                    : v.kind === "family-stories" ? "Family Stories"
                    : v.kind === "family-people" ? "Family People"
                    : v.kind === "family-tree" ? "Family Tree"
                    : v.title;
  }

  private unsubs: (() => void)[] = [];

  // The shelf owns the phone backdrop only while this leaf is active. Keep
  // ownership separate from the full-screen canvas, which also hides the dock.
  private static timelineSceneOwner: SGLibraryView | null = null;
  private syncTimelineScene = (): void => {
    if (!Platform.isMobile) return;
    if (this.view.kind !== 'timelines' || this.app.workspace.activeLeaf !== this.leaf || !this.contentEl.isConnected) {
      this.releaseTimelineScene();
      return;
    }
    SGLibraryView.timelineSceneOwner = this;
    const theme = this.s.device.tlWorldTheme ?? 'midnight';
    this.contentEl.setAttr('data-timeline-theme', theme);
    document.body.classList.add('sg-timeline-library-active');
    document.body.setAttribute('data-timeline-library-theme', theme);
    document.body.style.setProperty('--sg-library-timeline-art', `url("${timelineBackground}")`);
  };

  private releaseTimelineScene(): void {
    if (SGLibraryView.timelineSceneOwner !== this) return;
    SGLibraryView.timelineSceneOwner = null;
    document.body.classList.remove('sg-timeline-library-active');
    document.body.removeAttribute('data-timeline-library-theme');
    document.body.style.removeProperty('--sg-library-timeline-art');
  }

  private lastViewKey = '';
  private enterTimer: number | null = null;

  private render(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    const c = this.contentEl;
    // a focused search box must BLUR before the DOM under it is rebuilt:
    // destroying a focused input skips the blur, iOS drops the keyboard
    // silently, and Obsidian keeps the workspace at keyboard height — the
    // page then shows in the top half only (user-reported)
    releaseKeyboard(this.contentEl);
    c.empty();
    this.coversShown.length = 0;
    const v = this.view;
    c.toggleClass('sg-timeline-scene', v.kind === 'timelines');
    // The glass-tile look is proved on Home first (body.sg-glass scopes it here).
    c.toggleClass('sg-view-home', v.kind === 'home');
    // Content rises in only when the reader actually moved to another view —
    // a background refresh of the same view (sync landing, a count changing)
    // must never make the page flicker.
    const key = JSON.stringify(v);
    if (key !== this.lastViewKey) {
      this.lastViewKey = key;
      c.addClass('sg-view-enter');
      if (this.enterTimer !== null) window.clearTimeout(this.enterTimer);
      this.enterTimer = window.setTimeout(() => { this.enterTimer = null; c.removeClass('sg-view-enter'); }, 600);
    }
    this.syncTimelineScene();
    if (v.kind === 'timelines') c.setAttr('data-timeline-theme', this.s.device.tlWorldTheme ?? 'midnight');
    if (v.kind === 'timelines') c.style.setProperty('--sg-timeline-art', `url("${timelineBackground}")`);
    // GL's top-down header: chevron circle, then the big left-aligned title
    // the ‹ hangs from a zero-height sticky rail, so it stays reachable as
    // the shelf scrolls without dragging a bar across the scene
    if (v.kind !== "home") {
      const rail = c.createDiv({ cls: "sg-lp-stick" });
      const back = rail.createEl("button", { cls: "sg-nav-btn sg-lp-back", text: "‹" });
      back.setAttr("aria-label", "Back");
      back.onclick = () => this.back();
    }
    const head = c.createDiv({ cls: `sg-lp-head${v.kind !== "home" ? " sg-lp-head-indent" : ""}` });
    if (!(v.kind === 'work' && v.document)) head.createDiv({ cls: "sg-lp-title", text: this.title() });
    if (v.kind === 'home' || v.kind === 'scriptures') familyInboxButton(head, this.s, () => {
      new FamilyInboxModal(this.s, async path => {
        if (!lazyFetch || !(await lazyFetch(path))) throw Error('Page unavailable');
        await this.app.workspace.openLinkText(path, '');
      }).open();
    });

    // the dock lights the door you are behind — home, the shelf, or search
    window.setTimeout(() => document.dispatchEvent(new CustomEvent("sg-dock-refresh")), 0);
    const body = c.createDiv({ cls: "sg-lp-body" });
    // the family tree grows against its own dusk; every other page keeps the reader's scene
    this.host.scene?.(v.kind.startsWith('family') ? "grove" : null);
    if (v.kind === "home") this.renderHome(body);
    else if (v.kind === "scriptures") this.renderScriptures(body);
    else if (v.kind === "books") this.renderBooks(body, v.volume);
    else if (v.kind === "chapters") this.renderChapters(body, v.book);
    else if (v.kind === "graphs") this.renderGraphs(body);
    else if (v.kind === "maps") this.unsubs.push(renderAtlas(body, path => this.host.openNote(path)));
    else if (v.kind === 'photos') {
      const rows = photoLibrary(SCENES);
      const io: PhotoGalleryIO = {
        thumbnail: id => PHOTO_THUMBNAILS[id],
        select: id => this.go({ kind: 'photos', photo: id }),
        open: title => this.host.openChapter(title),
        preview: row => new EventBackgroundPreview(this.app,
          { scene: row.id, name: 'Artistic reading background', chapter: row.name, slug: '', volume: '' },
          (id, wide) => this.host.scenePhoto?.(id, wide) ?? Promise.reject(new Error('Photo cache unavailable'))).open(),
      };
      const selected = rows.find(row => row.id === v.photo);
      if (selected) renderPhotoDetail(body, selected, v, io);
      else renderPhotoGallery(body, rows, v, io);
    }
    else if (v.kind === 'event-backgrounds') {
      const photo = (id: string, wide: boolean) => this.host.scenePhoto?.(id, wide) ?? Promise.reject(new Error('Photo cache unavailable'));
      this.unsubs.push(renderEventBackgrounds(body, eventBackgrounds(Object.fromEntries(SCENES.map(s => [s.id, s.name]))), v.query ?? '', v.page ?? 0, {
        query: value => { v.query = value; }, page: value => { v.page = value; }, photo,
        preview: row => new EventBackgroundPreview(this.app, row, photo, title => this.host.openChapter(title)).open(),
        open: title => this.host.openChapter(title),
      }));
    }
    else if (v.kind === "work") this.renderWork(body, v.path, v);
    else if (v.kind === "marks") {
      const state = { get kind() { return v.mark; }, set kind(k) { v.mark = k; }, get query() { return v.query; }, set query(q) { v.query = q; },
        get recent() { return v.recent; }, set recent(r) { v.recent = r; } };
      renderMyMarks(body, {
        load: async () => ({ all: await this.s.sync.allAnnotations(), me: this.s.device.userId }),
        verseText: async anchor => (await this.verseWords()).get(anchor) ?? null,
        open: link => this.host.openNote(link),
        themes: () => this.s.settings.themes ?? [],
      }, state);
    }
    else if (v.kind === "timelines") this.renderTimelines(body);
    else if (v.kind === "questions") this.renderQuestions(body);
    else if (v.kind === "hymns") void this.renderHymns(body, v.book);
    else if (v.kind === "music") void this.renderMusic(body);
    else if (v.kind === "playlist") void this.renderPlaylist(body, v.key);
    else if (v.kind === "family-tree") void this.renderFamily(body);
    else if (v.kind === 'family' || v.kind === 'family-stories' || v.kind === 'family-people') {
      this.coverSeq = 0;
      renderFamilyLibrary(body, v.kind, v.query ?? '', {
        cover: (grid, options) => this.cover(grid, options),
        load: () => this.loadFamilyLibrary(),
        query: query => { v.query = query; },
        go: kind => this.go({ kind }),
        open: async path => this.host.openNote(path),
      });
    }
    else this.renderFolder(body, v.path);
  }

  /** which dock door this page sits behind */
  dockSlot(): "home" | "library" | "search" {
    if (this.view.kind !== "home") return "library";
    return this.searchQuery.trim() ? "search" : "home";
  }

  /** the Library — everything, in sections, the scriptures first (the dock's door) */
  showScriptures(): void {
    if (this.view.kind === "scriptures") return;
    this.trail = [{ kind: "home" }];
    this.view = { kind: "scriptures" };
    this.render();
  }

  /** home, with the search box focused and the keyboard up */
  showSearch(): void {
    if (this.view.kind !== "home") { this.trail = []; this.view = { kind: "home" }; this.render(); }
    const inp = this.contentEl.querySelector<HTMLInputElement>("input.sg-nav-search");
    inp?.focus();
    inp?.select();
  }

  /** home — the dock's ⌂ */
  showHome(): void {
    if (this.view.kind === "home") return;
    this.trail = [];
    this.view = { kind: "home" };
    this.render();
  }

  showMyWork(): void { this.go({ kind: 'work' }); }
  showMarks(): void { this.go({ kind: 'marks' }); }

  /** anchor -> verse words, from the search index this device already builds */
  private verseWordsMap: Promise<Map<string, string>> | null = null;
  private verseWords(): Promise<Map<string, string>> {
    this.verseWordsMap ??= buildSearchIndex(this.app).then(index => new Map(index.verses.map(v => [v.anchor, v.text])));
    return this.verseWordsMap;
  }
  showLesson(folder: string, destination: LessonDestination = {}): void {
    const root = lessonRoot(folder);
    if (!root) return;
    if (destination.document && lessonRoot(destination.document) === root) {
      this.host.openPath(destination.document);
      return;
    }
    this.go({ kind: 'work', path: root, ...destination });
  }

  private renderWork(body: HTMLElement, folder?: string, destination: LessonDestination = {}): void {
    const root = folder ? lessonRoot(folder) : null;
    if (root) {
      // Restore older 0.72.165 reading tabs into the real document reader.
      if (destination.document && lessonRoot(destination.document) === root) {
        this.host.openPath(destination.document);
        return;
      }
      renderLessonWorkspace(this.app, body, root, destination, this, next => this.showLesson(root, next), () => this.showMyWork(), researchSharing(this.s));
      return;
    }
    if (!folder) void sharedLessonsSection(body, this.s);
    const files = this.app.vault.getMarkdownFiles().filter(file => /^Library\/(Lessons|Study Plans|Research|AI Notes)\//.test(file.path)).sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (!folder) body.createEl('h2', { text: 'My lessons & notes' });
    const search = body.createEl('input', { type: 'search', cls: 'sg-work-search', attr: { placeholder: folder ? 'Find a document…' : 'Find a lesson or note…', 'aria-label': 'Search my work' } });
    const list = body.createDiv({ cls: 'sg-work-list' });
    const render = () => {
      list.empty();
      const query = search.value.trim().toLowerCase();
      const matches = files.filter(file => `${file.path} ${documentTitle(this.app, file)}`.toLowerCase().includes(query));
      if (folder) {
        const entries = matches.filter(file => file.path.slice(0, file.path.lastIndexOf('/')) === folder).sort((a, b) => Number(/^Reference/i.test(a.basename)) - Number(/^Reference/i.test(b.basename)));
        for (const file of entries) {
          const button = list.createEl('button', { cls: 'sg-work-item' });
          navIcon(button.createSpan({ cls: 'sg-work-icon' }), 'page');
          button.createSpan({ text: documentTitle(this.app, file) });
          button.onclick = () => this.host.openPath(file.path);
        }
        if (!entries.length) list.createEl('p', { text: 'No matching documents.' });
      } else {
        const folders = new Map<string, number>();
        for (const file of matches) { const path = lessonRoot(file.path) ?? file.path.slice(0, file.path.lastIndexOf('/')); folders.set(path, (folders.get(path) ?? 0) + 1); }
        for (const [path, count] of folders) {
          const button = list.createEl('button', { cls: 'sg-work-item' });
          navIcon(button.createSpan({ cls: 'sg-work-icon' }), 'folder');
          const label = button.createSpan();
          label.createEl('strong', { text: projectTitle(this.app, path) });
          const kind = lessonRoot(path) ? projectKind(path) : null;
          label.createEl('small', { text: kind === 'research' ? 'Research · Pages in folders' : kind === 'study-plan' ? 'Study plan · Resources inside' : kind ? 'Lesson · Resources inside' : `${count} notes` });
          button.onclick = () => this.go({ kind: 'work', path });
        }
        if (!folders.size) list.createEl('p', { text: query ? 'No matching projects.' : 'Your saved projects will appear here. Use the AI button below to create a lesson or notes.' });
      }
    };
    search.oninput = render; render();
  }

  /** jump straight to the Hard Questions shelf (the palette command lands here) */
  showQuestions(): void {
    if (this.view.kind === "questions") return;
    this.trail = [{ kind: "home" }];
    this.view = { kind: "questions" };
    this.render();
  }

  /** jump straight to the Graphs shelf (the palette command lands here) */
  showGraphs(): void {
    if (this.view.kind === "graphs") return;
    this.trail = [{ kind: "home" }];
    this.view = { kind: "graphs" };
    this.render();
  }

  // ------------------------------------------------------- come, follow me

  /** the lesson page by its full path; never a bare title (which makes
   * Obsidian create an empty note when the page is not on this device) */
  private openLesson(year: number, page: string): void {
    const path = `${CFM_FOLDER}/${year}/${page}.md`;
    // The shared navigation host fetches exactly this page before opening it.
    this.host.openPath(path);
  }

  /** Small feature indexes are fetched when used, independently of bulk sync. */
  private async localIndex(path: string): Promise<TFile | null> {
    const local = this.app.vault.getAbstractFileByPath(path);
    if (local instanceof TFile) return local;
    const pending = this.indexLoads.get(path);
    if (pending) return pending;
    const request = (async () => {
      try { await lazyFetch?.(path); } catch { /* show a retry; never create an empty note */ }
      const file = this.app.vault.getAbstractFileByPath(path);
      return file instanceof TFile ? file : null;
    })();
    this.indexLoads.set(path, request);
    try { return await request; } finally { this.indexLoads.delete(path); }
  }

  private indexRetry(slot: HTMLElement, label: string): void {
    if (!slot.isConnected) return;
    const retry = slot.createEl('button', { cls: 'sg-nav-dl', text: `Connect to load ${label} · Retry` });
    retry.onclick = () => this.render();
  }

  private async renderThisWeek(slot: HTMLElement): Promise<void> {
    const f = await this.localIndex(CFM_PATH);
    if (!f) { this.indexRetry(slot, 'Come, Follow Me'); return; }
    let data: { year: number; title: string; weeks: CfmWeek[] } | null = null;
    try {
      const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
      data = m ? JSON.parse(m[1]!) : null;
    } catch { data = null; }
    if (!data?.weeks?.length || !slot.isConnected) return;
    const today = new Date().toISOString().slice(0, 10);
    let wk = data.weeks.find(w => w.start <= today && today <= w.end)
      ?? data.weeks.find(w => w.start > today) ?? data.weeks[data.weeks.length - 1]!;
    const seenW = (this.s.device.seen ??= {});
    if (seenW.cfmWeek !== wk.week) { seenW.cfmWeek = wk.week; void this.s.saveDevice(); document.dispatchEvent(new CustomEvent("sg-dock-refresh")); }
    const card = slot.createDiv({ cls: "sg-cfm" });
    card.createDiv({ cls: "sg-cfm-eyebrow", text: `Come, Follow Me · ${wk.dates}` });
    card.createDiv({ cls: "sg-cfm-title", text: wk.block });
    const chips = card.createDiv({ cls: "sg-cfm-chips" });
    for (const ch of wk.chapters.slice(0, 8)) {
      const b = chips.createEl("button", { cls: "sg-cfm-chip", text: ch });
      b.onclick = () => this.host.openChapter(ch);
    }
    const idx = data.weeks.indexOf(wk);
    // the same row as the insight card below it: ‹ [Open the lesson] ›
    const row = card.createDiv({ cls: "sg-insight-actions" });
    const prev = row.createEl("button", { cls: "sg-insight-step", text: "‹" });
    if (wk.page) {
      const open = row.createEl("button", { cls: "sg-insight-read", text: "Open the lesson" });
      open.onclick = () => this.openLesson(data!.year, wk.page!);
    } else {
      row.createEl("button", { cls: "sg-insight-read", text: "Lesson arrives tonight", attr: { disabled: "" } });
    }
    const next = row.createEl("button", { cls: "sg-insight-step", text: "›" });
    card.createDiv({ cls: "sg-insight-count", text: `Week ${idx + 1} of ${data.weeks.length}` });
    const show = (i: number) => {
      const w = data!.weeks[i];
      if (!w) return;
      wk = w;
      slot.empty();
      // re-render around the chosen week without re-reading the file
      const c2 = slot.createDiv({ cls: "sg-cfm" });
      c2.createDiv({ cls: "sg-cfm-eyebrow", text: `Come, Follow Me · ${w.dates}` });
      c2.createDiv({ cls: "sg-cfm-title", text: w.block });
      const ch2 = c2.createDiv({ cls: "sg-cfm-chips" });
      for (const ch of w.chapters.slice(0, 8)) {
        const b = ch2.createEl("button", { cls: "sg-cfm-chip", text: ch });
        b.onclick = () => this.host.openChapter(ch);
      }
      const r2 = c2.createDiv({ cls: "sg-insight-actions" });
      const p2 = r2.createEl("button", { cls: "sg-insight-step", text: "‹" }); p2.onclick = () => show(i - 1);
      if (w.page) { const o = r2.createEl("button", { cls: "sg-insight-read", text: "Open the lesson" }); o.onclick = () => this.openLesson(data!.year, w.page!); }
      else r2.createEl("button", { cls: "sg-insight-read", text: "Lesson arrives tonight", attr: { disabled: "" } });
      const x2 = r2.createEl("button", { cls: "sg-insight-step", text: "›" }); x2.onclick = () => show(i + 1);
      c2.createDiv({ cls: "sg-insight-count", text: `Week ${i + 1} of ${data!.weeks.length}` });
    };
    prev.onclick = () => show(idx - 1);
    next.onclick = () => show(idx + 1);
  }

  // ----------------------------------------------------------------- music

  private async loadHymns(): Promise<Hymn[]> {
    const f = await this.localIndex(HYMNS_PATH);
    if (!(f instanceof TFile)) return [];
    try {
      const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
      return m ? (JSON.parse(m[1]!) as Hymn[]) : [];
    } catch { return []; }
  }

  private async loadPlaylists(): Promise<Playlist[]> {
    const f = await this.localIndex(MUSIC_PATH);
    if (!(f instanceof TFile)) return [];
    try {
      const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
      return m ? ((JSON.parse(m[1]!) as { playlists?: Playlist[] }).playlists ?? []) : [];
    } catch { return []; }
  }

  /** Music artwork is available even before any vault artwork downloads. */
  private art(key: string): string | undefined {
    const f = this.app.vault.getAbstractFileByPath(`AI Library/00 System/covers/${key}.jpg`);
    return f instanceof TFile ? this.app.vault.getResourcePath(f) : BUNDLED_COVERS[key];
  }

  private bookShort(h: Hymn): string {
    return h.book === "Children's Songbook" ? "Children's Songbook"
      : h.book === "Hymns—For Home and Church" ? "Hymn (new)" : `Hymn${h.n ? " " + h.n : ""}`;
  }

  /** a hymnbook entry → something the player can play */
  private hymnItem(h: Hymn, art?: string, open?: () => void): PlayItem {
    const a = h.audio ?? {};
    const url = a.vocal ?? a.other ?? a.accompaniment;
    const alt: { label: string; url: string }[] = [];
    if (a.accompaniment && url !== a.accompaniment) alt.push({ label: "Accompaniment only", url: a.accompaniment });
    if (a.vocal && url !== a.vocal) alt.push({ label: "With voices", url: a.vocal });
    return { id: h.uri, title: h.title, sub: `${this.bookShort(h)} · Church recording`, url, alt,
      searchQuery: `${h.title} hymn`, wordsUrl: h.url, art, open };
  }

  /** a playlist track → the hymnbook entry when the Church records it, else elsewhere */
  private trackItem(tr: Track, byTitle: Map<string, Hymn>, key: string, i: number, art?: string, open?: () => void): PlayItem {
    const inBook = tr.a === "Hymn" || tr.a === "Primary";
    const h = inBook ? byTitle.get(normTitle(tr.t)) : undefined;
    const choirWhen = tr.choir_when ? ` (${tr.choir_when})` : "";
    const ytOn = !!tr.yt && this.s.device.youtube !== false;
    if (h) {
      // in a playlist the Choir's performance leads; the plain hymnbook recording stays one tap away
      const base = this.hymnItem(h, art, open);
      if (tr.choir) {
        const alt = [{ label: "Plain hymnbook recording", url: base.url! }, ...(base.alt ?? [])];
        return { ...base, url: tr.choir, alt, yt: tr.yt || undefined, preferVideo: !!tr.yt,
          sub: `${this.bookShort(h)} · ${tr.yt && ytOn ? "YouTube" : `Tabernacle Choir${choirWhen}`}`,
          credit: `The Tabernacle Choir at Temple Square${choirWhen}`, searchQuery: `${tr.t} The Tabernacle Choir at Temple Square` };
      }
      // no Choir performance in the Church library: the plain recording plays headless;
      // the Choir's YouTube version waits in the ⋯ menu
      return { ...base, yt: tr.yt || undefined, preferVideo: !!tr.yt,
        sub: `${this.bookShort(h)} · ${tr.yt && ytOn ? "YouTube" : "Church recording"}`,
        searchQuery: `${tr.t} The Tabernacle Choir at Temple Square` };
    }
    const url = tr.choir || tr.church || tr.url || undefined;
    const churchLabel = tr.church ? `${tr.church_by || "Church recording"}${tr.church_when ? ` (${tr.church_when})` : ""}` : "";
    const how = ytOn ? "YouTube" : tr.choir ? `Tabernacle Choir${choirWhen}` : tr.church ? churchLabel : url ? "free recording" : this.host.music.spotify.connected ? "Spotify" : "no recording yet";
    return { id: `track:${key}:${i}`, title: tr.t, sub: `${tr.a} · ${how}`, url, yt: tr.yt || undefined, preferVideo: !!tr.yt,
      credit: tr.choir ? `The Tabernacle Choir at Temple Square${choirWhen}` : tr.church ? churchLabel : tr.credit,
      searchQuery: `${tr.t} ${inBook ? "The Tabernacle Choir at Temple Square" : tr.a}`, art, open };
  }

  /** one row: number, title, who — tap plays; ⋯ for the rest */
  private trackRow(list: HTMLElement, items: PlayItem[], i: number, num: string): void {
    const it = items[i]!;
    const music = this.host.music;
    const row = list.createDiv({ cls: "sg-tr" });
    cascade(row, i);
    const cur = music.isCurrent(it.id);
    row.toggleClass("sg-tr-on", cur);
    row.createSpan({ cls: "sg-tr-n", text: cur ? (music.playing ? "♪" : "▮▮") : num });
    const col = row.createDiv({ cls: "sg-tr-col" });
    col.createDiv({ cls: "sg-tr-title", text: it.title });
    col.createDiv({ cls: "sg-tr-sub", text: it.sub });
    if (!music.canPlay(it)) row.createSpan({ cls: "sg-tr-ext", text: "soon" });
    else if (!music.headless(it)) row.createSpan({ cls: "sg-tr-ext", text: "video" });
    const more = row.createEl("button", { cls: "sg-tr-more", text: "⋯" });
    more.setAttr("aria-label", "More");
    more.onclick = (e) => { e.stopPropagation(); music.menu(it, e); };
    row.onclick = () => { if (cur && music.active) music.toggle(); else music.play(items, i); };
  }

  /** the shelf: Hymns, Children's songs, then the playlists, as covers */
  private async renderMusic(c: HTMLElement): Promise<void> {
    const lists = await this.loadPlaylists();
    if (!c.isConnected) return;
    this.coverSeq = 0;
    const grid = c.createDiv({ cls: "sg-nav-covers" });
    this.cover(grid, { icon: "podcast", label: "Hymns", photo: "hymnbook", onTap: () => this.go({ kind: "hymns" }) });
    this.cover(grid, { icon: "podcast", label: "Children's Songs", photo: "music-family", onTap: () => this.go({ kind: "hymns", book: "Children's Songbook" }) });
    for (const pl of lists) {
      this.cover(grid, { icon: "podcast", label: pl.title, photo: pl.cover ?? `music-${pl.key}`,
        fallbackPhoto: 'hymns',
        onTap: () => this.go({ kind: "playlist", key: pl.key, title: pl.title }) });
    }
    if (!lists.length) this.indexRetry(c, 'playlists');
  }

  /** the hymnbook (or the Children's Songbook): search, tap to play */
  private async renderHymns(c: HTMLElement, book?: string): Promise<void> {
    const all = await this.loadHymns();
    if (!c.isConnected) return;
    if (!all.length) { this.indexRetry(c, 'songs'); return; }
    const isChildren = book === "Children's Songbook";
    const hymns = all.filter(h => isChildren ? h.book === "Children's Songbook" : h.book !== "Children's Songbook");
    hymns.sort((a, b) => (a.n ?? 9999) - (b.n ?? 9999) || a.title.localeCompare(b.title));
    const art = this.art(isChildren ? "music-family" : "hymnbook");
    const open = () => this.go({ kind: "hymns", book });
    const head = c.createDiv({ cls: "sg-pl-head" });
    if (art) { const img = head.createEl("img", { cls: "sg-pl-art" }); img.src = art; }
    const meta = head.createDiv({ cls: "sg-pl-meta" });
    meta.createDiv({ cls: "sg-pl-title", text: isChildren ? "Children's Songbook" : "Hymns" });
    meta.createDiv({ cls: "sg-pl-blurb", text: isChildren ? "Every Primary song, in the Church's recordings." : "Both hymnbooks, in the Church's recordings. Tap to play." });
    meta.createDiv({ cls: "sg-pl-count", text: `${hymns.length} songs` });
    const inp = c.createEl("input", { cls: "sg-nav-filter", attr: { type: "search", placeholder: isChildren ? "Find a song…" : "Name or number…" } });
    let only: "all" | "old" | "new" = "all";
    if (!isChildren) {
      const chips = c.createDiv({ cls: "sg-pl-chips" });
      const mk = (label: string, v: typeof only) => {
        const b = chips.createEl("button", { cls: "sg-pl-chip", text: label });
        b.onclick = () => { only = v; render(); };
        return b;
      };
      mk("All", "all"); mk("1985 hymnal", "old"); mk("New hymns", "new");
    }
    const list = c.createDiv({ cls: "sg-tr-list" });
    const render = () => {
      list.empty();
      for (const b of Array.from(c.querySelectorAll(".sg-pl-chip"))) {
        b.toggleClass("sg-pl-chip-on", (b.textContent === "All" && only === "all") || (b.textContent === "1985 hymnal" && only === "old") || (b.textContent === "New hymns" && only === "new"));
      }
      const q = inp.value.trim().toLowerCase();
      const shown = hymns.filter(h => (only === "all" || (only === "old" ? h.book === "Hymns" : h.book === "Hymns—For Home and Church"))
        && (!q || h.title.toLowerCase().includes(q) || String(h.n ?? "").startsWith(q))).slice(0, 500);
      const items = shown.map(h => this.hymnItem(h, art, open));
      shown.forEach((h, i) => this.trackRow(list, items, i, h.n ? String(h.n) : String(i + 1)));
      if (!shown.length) list.createDiv({ cls: "sg-nav-empty", text: all.length ? "No song matches." : "The hymn index has not synced yet." });
    };
    inp.oninput = render;
    render();
    this.unsubs.push(this.host.music.on(() => { if (list.isConnected) render(); }));
  }

  /** one playlist: cover, Play, rows */
  private async renderPlaylist(c: HTMLElement, key: string): Promise<void> {
    const [lists, hymns, added] = await Promise.all([this.loadPlaylists(), this.loadHymns(),
      songsOn(this.host.ann, key).catch(() => [])]);
    if (!c.isConnected) return;
    const pl = lists.find(l => l.key === key);
    if (!pl) { c.createDiv({ cls: "sg-nav-empty", text: "That playlist is gone." }); return; }
    const byTitle = new Map<string, Hymn>();
    for (const h of hymns) { const bare = normTitle(h.title.replace(/\s*\(.*?\)\s*$/, "")); if (!byTitle.has(bare)) byTitle.set(bare, h); }
    for (const h of hymns) byTitle.set(normTitle(h.title), h);
    const art = this.art(pl.cover ?? `music-${pl.key}`);
    const open = () => this.go({ kind: "playlist", key: pl.key, title: pl.title });
    const items = pl.tracks.map((tr, i) => this.trackItem(tr, byTitle, key, i, art, open));
    // the family's additions ride at the end, in the order they were added
    for (const [j, song] of added.entries()) {
      const it = this.trackItem({ t: song.t, a: song.a, yt: song.yt }, byTitle, key, pl.tracks.length + j, art, open);
      it.id = `added:${song.id}`;
      if (song.mine) it.remove = () => void this.host.ann.remove(song.id).then(() => { new Notice(`Removed “${song.t}”`); this.render(); });
      items.push(it);
    }
    const here = items.filter(i => this.host.music.headless(i)).length;
    const head = c.createDiv({ cls: "sg-pl-head" });
    if (art) { const img = head.createEl("img", { cls: "sg-pl-art" }); img.src = art; }
    const meta = head.createDiv({ cls: "sg-pl-meta" });
    meta.createDiv({ cls: "sg-pl-title", text: pl.title });
    if (pl.blurb) meta.createDiv({ cls: "sg-pl-blurb", text: pl.blurb });
    const vids = items.filter(i => !this.host.music.headless(i) && this.host.music.canPlay(i)).length;
    meta.createDiv({ cls: "sg-pl-count", text: `${items.length} songs · ${here} play here${vids ? ` · ${vids} video only` : ""}` });
    const acts = c.createDiv({ cls: "sg-pl-actions" });
    const play = acts.createEl("button", { cls: "sg-pl-play", text: "▶  Play" });
    play.onclick = () => this.host.music.playAll(items);
    const shuf = acts.createEl("button", { cls: "sg-pl-shuffle", text: "⇄  Shuffle" });
    shuf.onclick = () => this.host.music.playAll(items, true);
    const addBtn = acts.createEl("button", { cls: "sg-pl-add", text: "＋  Add" });
    addBtn.setAttr("aria-label", "Add a song from a YouTube link");
    addBtn.onclick = () => new AddSongModal(this.s, this.host.ann, key, pl.title, () => this.render()).open();
    const list = c.createDiv({ cls: "sg-tr-list" });
    const render = () => { list.empty(); items.forEach((_, i) => this.trackRow(list, items, i, String(i + 1))); };
    render();
    this.unsubs.push(this.host.music.on(() => { if (list.isConnected) render(); }));
  }

  // ---------------------------------------------------------------- family

  private async loadFamilyLibrary() {
    const [treeResult, storyResult] = await Promise.allSettled([
      this.familyTreeData(),
      (async () => {
        const file = await this.familyIndex('Family Stories');
        if (!file) return null;
        const match = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(file));
        const data = match ? JSON.parse(match[1]!) : null;
        return Array.isArray(data?.stories) ? data.stories : null;
      })(),
    ]);
    const tree = treeResult.status === 'fulfilled' ? treeResult.value : null;
    const stories = storyResult.status === 'fulfilled' ? storyResult.value : null;
    const files = ['AI Library/12 Family', 'AI Library/12 Family/Stories'].flatMap(path => this.host.listFolder(path).files);
    return { rows: familyEntries(tree, stories ?? [], files), incomplete: !tree || !stories,
      relevant: relevantFamilyPeople(tree, tree ? this.viewerTreeId(tree) : null, this.viewerSpouse()) };
  }

  /** Only fetch these two small indexes; records and media remain on demand.
   * Vault lookup also works before Obsidian's link cache catches up. */
  private familyIndex(name: "Family Tree" | "Family Stories"): Promise<TFile | null> {
    const find = () => this.app.vault.getMarkdownFiles().find(f =>
      f.path.startsWith("AI Library/12 Family/") && f.basename === name)
      ?? this.app.metadataCache.getFirstLinkpathDest(name, "");
    const local = find();
    if (local instanceof TFile) return Promise.resolve(local);
    const pending = this.familyIndexLoads.get(name);
    if (pending) return pending;
    const request = (async () => {
      try { if (lazyFetch) await lazyFetch(name); } catch { /* offline: omit the card */ }
      const file = find();
      return file instanceof TFile ? file : null;
    })();
    this.familyIndexLoads.set(name, request);
    void request.finally(() => this.familyIndexLoads.delete(name));
    return request;
  }

  private async familyTreeData(): Promise<TreeData | null> {
    const file = await this.familyIndex("Family Tree");
    if (!file) return null;
    try {
      const match = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(file));
      return match ? JSON.parse(match[1]!) as TreeData : null;
    } catch { return null; }
  }

  private viewerTreeId(data: TreeData): string | null {
    const d = this.s.device;
    return familyViewer(data, d.familyProfileUserId === d.userId ? d.familyPersonId : null, d.displayName);
  }

  private viewerSpouse(): FamilySpouse | undefined {
    const d = this.s.device;
    return d.familyProfileUserId === d.userId && d.familySpouseId
      ? { pid: d.familySpouseId, label: d.familySpouseLabel ?? 'spouse' } : undefined;
  }

  /** the pedigree, drawn from the engine's Family Tree note; the list of
   * everyone is a tap away */
  private async renderFamily(c: HTMLElement): Promise<void> {
    c.createDiv({ cls: "sg-nav-progress", text: "Opening the family tree…" });
    const data = await this.familyTreeData();
    if (!c.isConnected) return;
    c.empty();
    if (!data || !data.roots.length) {
      c.createDiv({ cls: "sg-nav-empty", text: "The family tree isn't available right now. Your stories and people are in the Family library." });
      const row = c.createDiv({ cls: "sg-nav-row" });
      navIcon(row, "folder");
      row.createSpan({ cls: "sg-nav-name", text: "Family shelf" });
      row.createSpan({ cls: "sg-nav-chev", text: "›" });
      row.onclick = () => this.go({ kind: "family" });
      return;
    }
    const tree = new FamilyTree({
      app: this.app,
      openNote: (link) => this.host.openNote(link),
      openList: () => this.go({ kind: "family-people" }),
    }, data, this.viewerTreeId(data) ?? data.roots[0]!.pid);
    tree.render(c.createDiv());
    // the grove, again, once the page has settled — whatever else may have
    // set the backdrop in between
    window.setTimeout(() => { if (this.view.kind === "family-tree") this.host.scene?.("grove"); }, 500);
  }

  // ------------------------------------------------------- did you notice?

  private insightPool: Insight[] | null = null;

  private async loadInsights(): Promise<Insight[]> {
    if (this.insightPool) return this.insightPool;
    const f = await this.localIndex(INSIGHTS_PATH);
    if (!(f instanceof TFile)) return [];
    try {
      const raw = await this.app.vault.cachedRead(f);
      const m = /```json\s*([\s\S]*?)```/.exec(raw);
      const arr = m ? (JSON.parse(m[1]!) as Insight[]) : [];
      this.insightPool = arr.filter(i => i && i.id && i.title && i.hook);
    } catch {
      this.insightPool = [];
    }
    return this.insightPool;
  }

  /** one a day, deterministic across the family's devices (day-of-year),
   * with "Another" stepping the device forward through the pool */
  private async renderInsight(slot: HTMLElement): Promise<void> {
    const pool = await this.loadInsights();
    if (!pool.length || !slot.isConnected) return;
    const day = Math.floor(Date.now() / 86_400_000);
    const step = this.s.device.insightStep ?? 0;
    const it = pool[((day + step) % pool.length + pool.length) % pool.length]!;
    slot.empty();
    const card = slot.createDiv({ cls: "sg-insight" });
    card.createDiv({ cls: "sg-insight-eyebrow", text: "Did you notice?" });
    card.createDiv({ cls: "sg-insight-title", text: it.title });
    card.createDiv({ cls: "sg-insight-hook", text: it.hook });
    const refs = card.createDiv({ cls: "sg-insight-refs" });
    for (const r of it.refs ?? []) {
      const chip = refs.createEl("button", { cls: "sg-insight-ref", text: r.label });
      chip.onclick = () => this.host.openNote(`${r.chapter}#^${r.anchor}`);
    }
    const row = card.createDiv({ cls: "sg-insight-actions" });
    const go = (delta: number) => {
      this.s.device.insightStep = step + delta;
      void this.s.saveDevice();
      void this.renderInsight(slot);
    };
    const prev = row.createEl("button", { cls: "sg-insight-step", text: "‹" });
    prev.setAttr("aria-label", "Previous");
    prev.onclick = () => go(-1);
    const read = row.createEl("button", { cls: "sg-insight-read", text: `Read ${it.read}` });
    read.onclick = () => this.host.openChapter(it.read);
    const next = row.createEl("button", { cls: "sg-insight-step", text: "›" });
    next.setAttr("aria-label", "Next");
    next.onclick = () => go(1);
    const idx = ((day + step) % pool.length + pool.length) % pool.length;
    card.createDiv({ cls: "sg-insight-count", text: `${idx + 1} of ${pool.length}` });
    // seen: the Home badge rests until tomorrow's card
    const seen = (this.s.device.seen ??= {});
    if (seen.insightDay !== day) { seen.insightDay = day; void this.s.saveDevice(); document.dispatchEvent(new CustomEvent("sg-dock-refresh")); }
  }

  // ------------------------------------------------------------ cover cards

  private coverSeq = 0;
  /** pictures already on the page being drawn, in order: no two tiles share
   * one, and on a shelf longer than the artwork (a periodical run) no picture
   * comes back within COVER_WINDOW tiles — more than a phone screen */
  private coversShown: string[] = [];

  private cover(grid: HTMLElement, opts: {
    icon?: NavIconName; hue?: string; label: string;
    lines?: string[]; jacket?: string; photo?: string; onTap: () => void;
    /** art to borrow when covers/<photo>.jpg is missing (a sub-shelf wears its shelf's photo) */
    fallbackPhoto?: string;
    /** short text printed on the art itself — a year on an archive tile */
    stamp?: string;
  }): void {
    const card = grid.createDiv({ cls: "sg-nav-cover" });
    card.setAttr("role", "button");
    card.setAttr("tabindex", "0");
    card.setAttr("aria-label", opts.label);
    card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); } };
    cascade(card, this.coverSeq++);
    const hue = opts.hue ?? (opts.icon ? iconHue(opts.icon) : "#8fa3c8");
    card.style.setProperty("--ico", hue);
    const art = card.createDiv({ cls: "sg-nav-cover-art" });
    if (opts.jacket) art.addClass(opts.jacket);
    art.style.setProperty("--ico", hue);
    if (opts.lines) {
      const stack = art.createDiv({ cls: "sg-cover-lines" });
      for (const line of opts.lines) {
        stack.createDiv({ cls: "sg-cover-line", text: line });
      }
    } else if (opts.icon) {
      navIcon(art, opts.icon);
    }
    // All authored shelf photos ship with the plugin. A local replacement
    // wins when readable; missing/broken local files fall back to bundled art.
    // A tile without a picture of its own, or whose picture is already on
    // this page, takes a different fitting one (distinctCover) — tiles used
    // to inherit their shelf's photo, so a shelf could show one image twelve times.
    const local = (name: string) => {
      const file = this.app.vault.getAbstractFileByPath(`${COVERS_PATH}/${name}.jpg`);
      return file instanceof TFile ? this.app.vault.getResourcePath(file) : null;
    };
    const same = (k: string) => (k === "scriptures" ? "bible" : k);
    const want = same(opts.photo ?? (opts.jacket ? "scriptures" : opts.icon) ?? "") || undefined;
    const key = distinctCover(want, opts.fallbackPhoto, opts.label, this.coversShown,
      k => !!BUNDLED_COVERS[k] || !!local(k), { window: COVER_WINDOW, relatedOnly: !!opts.stamp });
    if (key) this.coversShown.push(same(key));
    mountCoverPhoto(art, coverPhotoSources(key, key === want ? opts.fallbackPhoto : undefined, local, BUNDLED_COVERS));
    if (opts.stamp) art.createDiv({ cls: "sg-nav-cover-stamp", text: opts.stamp });
    card.createDiv({ cls: "sg-nav-cover-label", text: opts.label });
    card.onclick = opts.onTap;
  }

  // ------------------------------------------------------------------ home

  private renderHome(c: HTMLElement): void {
    this.coverSeq = 0;
    const wrap = c.createDiv({ cls: "sg-nav-searchwrap" });
    navIcon(wrap, "search").addClass("sg-nav-searchico");
    const inp = wrap.createEl("input", {
      cls: "sg-nav-filter sg-nav-search",
      attr: { type: "search", placeholder: "Search scriptures, people, places…", enterkeyhint: "search" },
    });
    inp.value = this.searchQuery;
    // Recent and saved searches, under the box while it is empty and focused;
    // filter chips once there is a query. Both are only lenses on the search.
    const recents = c.createDiv({ cls: "sg-search-recents" });
    const scopes = c.createDiv({ cls: "sg-search-scopes", attr: { role: "tablist", "aria-label": "Search in" } });
    const body = c.createDiv({ cls: "sg-nav-searchhost" });
    const d = this.s.device as { recentSearches?: string[]; savedSearches?: string[] };
    const rerun = () => { const q = inp.value.trim(); if (q.length >= 2) this.runSearch(q, body); };
    const drawScopes = () => {
      scopes.empty();
      const q = inp.value.trim();
      scopes.toggleClass("sg-search-scopes-on", q.length >= 2);
      if (q.length < 2) return;
      for (const sc of SEARCH_SCOPES) {
        const on = this.searchScope === sc.key;
        const b = scopes.createEl("button", { cls: `sg-search-chip${on ? " sg-search-chip-on" : ""}`, text: sc.label, attr: { role: "tab", "aria-selected": String(on) } });
        b.onclick = () => { this.searchScope = sc.key; this.searchVolume = null; drawScopes(); rerun(); };
      }
      const saved = (d.savedSearches ?? []).some(x => x.toLowerCase() === q.toLowerCase());
      const star = scopes.createEl("button", { cls: `sg-search-chip sg-search-save${saved ? " sg-search-chip-on" : ""}`, text: saved ? "★ Saved" : "☆ Save",
        attr: { "aria-label": saved ? "Remove this saved search" : "Save this search" } });
      star.onclick = () => {
        d.savedSearches = saved ? (d.savedSearches ?? []).filter(x => x.toLowerCase() !== q.toLowerCase()) : rememberSearch(d.savedSearches ?? [], q, 12);
        void this.s.saveDevice(); drawScopes();
      };
      if (this.searchScope === "scripture") {
        const vols = scopes.createDiv({ cls: "sg-search-volumes" });
        for (const v of [null, ...SEARCH_VOLUMES] as (Volume | null)[]) {
          const on = this.searchVolume === v;
          const b = vols.createEl("button", { cls: `sg-search-chip sg-search-vol${on ? " sg-search-chip-on" : ""}`, text: v ?? "Every volume" });
          b.onclick = () => { this.searchVolume = v; drawScopes(); rerun(); };
        }
      }
    };
    const drawRecents = () => {
      recents.empty();
      const show = document.activeElement === inp && inp.value.trim().length < 2;
      const saved = d.savedSearches ?? [], recent = (d.recentSearches ?? []).filter(r => !saved.some(x => x.toLowerCase() === r.toLowerCase()));
      recents.toggleClass("sg-search-recents-on", show && !!(saved.length || recent.length));
      if (!show) return;
      for (const [q, kind] of [...saved.map(q => [q, "saved"]), ...recent.map(q => [q, "recent"])] as [string, string][]) {
        const b = recents.createEl("button", { cls: `sg-search-chip sg-search-${kind}`, text: kind === "saved" ? `★ ${q}` : q,
          attr: { "aria-label": `${kind === "saved" ? "Saved" : "Recent"} search: ${q}` } });
        // pointerdown, not click: the tap must land before the box loses focus
        b.onpointerdown = e => { e.preventDefault(); inp.value = q; inp.dispatchEvent(new Event("input")); };
      }
      if (recent.length) {
        const clear = recents.createEl("button", { cls: "sg-search-chip sg-search-clear", text: "Clear recent" });
        clear.onpointerdown = e => { e.preventDefault(); d.recentSearches = []; void this.s.saveDevice(); drawRecents(); };
      }
    };
    inp.addEventListener("focus", drawRecents);
    inp.addEventListener("blur", () => window.setTimeout(drawRecents, 150));
    // a search counts as "used" when one of its results is opened
    body.addEventListener("click", e => {
      const q = inp.value.trim();
      if (q.length >= 2 && (e.target as HTMLElement).closest(".sg-nav-row, .sg-nav-hit")) {
        d.recentSearches = rememberSearch(d.recentSearches ?? [], q);
        void this.s.saveDevice();
      }
    }, true);
    const showHome = () => {
      this.searchSeq++;
      body.empty();
      this.renderShelf(body);
    };
    inp.oninput = () => {
      this.searchQuery = inp.value;
      drawScopes(); drawRecents();
      document.dispatchEvent(new CustomEvent("sg-dock-refresh"));
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      const q = inp.value.trim();
      if (q.length < 2) { this.searchTimer = null; showHome(); return; }
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.runSearch(q, body);
      }, 160);
    };
    const q0 = this.searchQuery.trim();
    drawScopes();
    if (q0.length >= 2) this.runSearch(q0, body);
    else this.renderShelf(body);
  }

  /** Home search filter chips; "all" = exactly the search as it always was */
  private searchScope: SearchScope = "all";
  private searchVolume: Volume | null = null;

  private renderShelf(c: HTMLElement): void {
    this.coverSeq = 0;
    // HOME IS TODAY. Four things, in the order a study session happens:
    // this week's lesson, the chapter you were in, one thing worth noticing,
    // and what the family is reading. Everything else lives in the Library.
    // 📅 Come, Follow Me — this week, from the engine's index
    void this.renderThisWeek(c.createDiv({ cls: "sg-cfm-slot" }));
    // 📖 Continue — the chapter you were in, one tap back; the ones before it beside
    this.renderContinue(c.createDiv({ cls: "sg-continue-slot" }));
    // 🌳 This week in your family — birthdays and anniversaries of your ancestors
    void this.renderFamilyWeek(c.createDiv({ cls: "sg-famweek-slot" }));
    // 📖 A story from your family — one a day, the best ones first
    void this.renderFamilyStory(c.createDiv({ cls: "sg-famstory-slot" }));
    // ✦ Did you notice? — one deep, faith-building connection a day
    void this.renderInsight(c.createDiv({ cls: "sg-insight-slot" }));
    // what the family is studying — quiet rows
    const groupsBox = c.createDiv({ cls: "sg-nav-groups" });
    const actsP = this.groupActs ? Promise.resolve(this.groupActs) : this.host.groupActivity();
    void actsP.then(acts => {
      this.groupActs = acts;
      if (!acts.length || this.view.kind !== "home" || !groupsBox.isConnected) return;
      groupsBox.createDiv({ cls: "sg-nav-sect", text: "Studying with your groups" });
      for (const a of acts.slice(0, 4)) {
        const title = titleForChapterSlug(a.chapter_slug);
        if (!title) continue;
        const row = groupsBox.createDiv({ cls: "sg-nav-row sg-nav-group" });
        navIcon(row, "groups");
        const col = row.createDiv({ cls: "sg-nav-gcol" });
        col.createDiv({ cls: "sg-nav-name", text: title });
        col.createDiv({
          cls: "sg-nav-gsub",
          text: `${a.group_name} · ${a.count} note${a.count === 1 ? "" : "s"}`
            + (a.others ? "" : " (all yours)"),
        });
        row.onclick = () => this.host.openChapter(title);
      }
    }).catch(() => { /* offline: the section simply doesn't appear */ });
    // the one door onward: the Library holds the shelves
    const browse = c.createDiv({ cls: "sg-nav-row sg-home-browse" });
    navIcon(browse, "library");
    const col = browse.createDiv({ cls: "sg-nav-gcol" });
    col.createDiv({ cls: "sg-nav-name", text: "Browse the Library" });
    col.createDiv({ cls: "sg-nav-gsub", text: "Scriptures, conference, history, topics, music" });
    browse.createSpan({ cls: "sg-nav-chev", text: "›" });
    browse.onclick = () => this.go({ kind: "scriptures" });
  }

  /** one story a day from the family shelf: the highest grades first, the
   * ones not heard lately ahead of the rest, a birthday this week ahead of
   * everything. Listen (the telling, the whole story) or read. */
  private async renderFamilyStory(slot: HTMLElement): Promise<void> {
    const f = await this.familyIndex("Family Stories");
    if (!f) { slot.remove(); return; }
    let data: { stories: StoryRow[] } | null = null;
    try {
      const raw = await this.app.vault.cachedRead(f);
      const m = /```json\s*([\s\S]*?)```/.exec(raw);
      data = m ? (JSON.parse(m[1]!) as { stories: StoryRow[] }) : null;
    } catch { data = null; }
    if (!data?.stories?.length || !slot.isConnected) { slot.remove(); return; }
    const heard = new Set(((this.s.device as { storiesHeard?: string[] }).storiesHeard ?? []).slice(-60));
    const tree = await this.familyTreeData();
    const related = relevantFamilyPeople(tree, tree ? this.viewerTreeId(tree) : null, this.viewerSpouse());
    const stories = relevantFamilyStories(data.stories, related);
    if (!stories.length || !slot.isConnected) { slot.remove(); return; }
    const today = new Date();
    const md = (d: string | undefined) => monthDay(d);
    const thisWeek = new Set<string>();
    if (tree) {
      for (const [pid, n] of Object.entries(tree.people)) {
        const b = md(n.bf);
        if (b && Math.abs((new Date(today.getFullYear(), b.m - 1, b.d).getTime() - today.getTime()) / 86_400_000) <= 3) thisWeek.add(pid);
      }
    }
    // the day's pick: deterministic for the day, weighted by grade, freshness, the week
    const day = Math.floor(today.getTime() / 86_400_000);
    const score = (r: StoryRow, i: number) => (r.grade || 0) * 10 + (heard.has(r.id) ? -25 : 0)
      + (r.people.some(p => thisWeek.has(p.pid)) ? 30 : 0) + (r.audio?.telling ? 4 : 0) + ((day * 7 + i * 13) % 9);
    const ranked = stories.filter(r => r.grade >= 3).map((r, i) => [score(r, i), r] as const).sort((a, b) => b[0] - a[0]);
    const pick = ranked[0]?.[1] ?? stories[0]!;
    const who = pick.people.map(p => p.n).join(" & ");
    const relative = pick.people.find(p => related.has(p.pid));
    const rel = tree && relative ? relationLabel(tree, this.viewerTreeId(tree), relative.pid, this.viewerSpouse()) : { kin: "", path: "" };
    const card = slot.createDiv({ cls: "sg-cfm sg-famstory" });
    card.createDiv({ cls: "sg-cfm-eyebrow", text: "A story from your family" });
    card.createDiv({ cls: "sg-famstory-who", text: rel.kin && rel.kin !== "you" ? `${who} · ${rel.kin}` : who });
    card.createDiv({ cls: "sg-cfm-title", text: pick.title });
    if (pick.hook) card.createDiv({ cls: "sg-famstory-hook", text: pick.hook });
    const meta = [pick.grade ? "★".repeat(pick.grade) : "", `${pick.minutes} min read`].filter(Boolean).join(" · ");
    card.createDiv({ cls: "sg-famstory-meta", text: meta });
    const chips = card.createDiv({ cls: "sg-cfm-chips" });
    const markHeard = async () => {
      const d = this.s.device as { storiesHeard?: string[] };
      d.storiesHeard = [...(d.storiesHeard ?? []).filter(x => x !== pick.id), pick.id].slice(-200);
      await this.s.saveDevice();
    };
    const storyPath = (pick.page.startsWith("AI Library/") ? pick.page : `AI Library/12 Family/Stories/${pick.page}`).replace(/\.md$/, '') + '.md';
    let opening = false;
    const openPage = async () => {
      if (opening) return;
      opening = true;
      read.disabled = true;
      read.setText("Opening…");
      try {
        const opened = await this.host.openNote(storyPath);
        if (opened !== false) await markHeard();
      } catch { new Notice("Couldn't open that story. Please try again."); }
      finally { opening = false; read.disabled = false; read.setText("📖 Read"); }
    };
    if (pick.audio?.telling && this.host.playFiles) {
      const b = chips.createEl("button", { cls: "sg-cfm-chip", text: "🎧 Listen · 5 min" });
      b.onclick = () => { void markHeard(); void this.host.playFiles!([{ path: pick.audio!.telling!, title: pick.title, sub: `${who} · the telling`, open: openPage }]); };
    }
    const fullTracks = pick.audio?.full ? [pick.audio.full] : pick.audioChapters ?? [];
    if (fullTracks.length && this.host.playFiles) {
      const b = chips.createEl("button", { cls: "sg-cfm-chip", text: fullTracks.length > 1 ? `🎧 Whole story · ${fullTracks.length} chapters` : "🎧 Whole story" });
      b.onclick = () => { void markHeard(); void this.host.playFiles!(fullTracks.map((p, i) => ({ path: p, title: fullTracks.length > 1 ? `${pick.title} — chapter ${i + 1}` : pick.title, sub: who, open: openPage }))); };
    }
    if (pick.audio?.kids && this.host.playFiles) {
      const b = chips.createEl("button", { cls: "sg-cfm-chip", text: "🧒 For the kids" });
      b.onclick = () => { void markHeard(); void this.host.playFiles!([{ path: pick.audio!.kids!, title: pick.title, sub: `${who} · for children`, open: openPage }]); };
    }
    const read = chips.createEl("button", { cls: "sg-cfm-chip", text: "📖 Read" });
    read.onclick = openPage;
    const more = chips.createEl("button", { cls: "sg-cfm-chip sg-famstory-more", text: "Another ›" });
    more.onclick = async () => { await markHeard(); slot.empty(); void this.renderFamilyStory(slot); };
  }

  /** ancestors whose birthday or anniversary falls this week, from the
   * family tree note; nothing when the shelf has no tree yet */
  private async renderFamilyWeek(slot: HTMLElement): Promise<void> {
    const data = await this.familyTreeData();
    if (!data || !slot.isConnected) { slot.remove(); return; }
    const today = new Date();
    const doy = (m: number, d: number) => { const t = new Date(today.getFullYear(), m - 1, d); return Math.round((t.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86_400_000); };
    const now = doy(today.getMonth() + 1, today.getDate());
    const viewer = this.viewerTreeId(data);
    if (!viewer) { slot.remove(); return; }
    const rows: { pid: string; n: TreeNode; what: string; when: string; delta: number; kin: string }[] = [];
    for (const [pid, n] of Object.entries(data.people)) {
      if (n.living || !n.page) continue;
      const kin = relationLabel(data, viewer, pid, this.viewerSpouse()).kin;
      if (viewer && !kin) continue;
      for (const [date, what] of [[n.bf, "born"], [n.df, "died"]] as const) {
        const md = monthDay(date);
        if (!md) continue;
        let delta = doy(md.m, md.d) - now;
        if (delta < -3) delta += 365;
        if (delta < -3 || delta > 3) continue;
        const year = /\d{4}/.exec(date ?? "")?.[0];
        const ago = year ? `${today.getFullYear() - Number(year)} years ago` : "";
        rows.push({ pid, n, what, kin, when: delta === 0 ? "today" : delta === 1 ? "tomorrow" : delta === -1 ? "yesterday" : delta > 0 ? `in ${delta} days` : `${-delta} days ago`, delta: Math.abs(delta) });
        rows[rows.length - 1]!.what = `${what} ${ago}`.trim();
      }
    }
    if (!rows.length) { slot.remove(); return; }
    rows.sort((a, b) => a.delta - b.delta);
    const card = slot.createDiv({ cls: "sg-cfm sg-famweek" });
    card.createDiv({ cls: "sg-cfm-eyebrow", text: "This week in your family" });
    for (const r of rows.slice(0, 4)) {
      const row = card.createEl("button", { cls: "sg-famweek-row", attr: { type: "button", "aria-label": `Open ${r.n.n}` } });
      row.createSpan({ cls: "sg-famweek-name", text: r.n.n });
      if (r.kin) row.createSpan({ cls: 'sg-famweek-sub', text: r.kin });
      row.createSpan({ cls: "sg-famweek-sub", text: `${r.what} · ${r.when}` });
      row.onclick = () => this.host.openNote(`AI Library/12 Family/${r.n.page!.replace(/\.md$/, '')}.md`);
    }
    const all = card.createEl("button", { cls: "sg-cfm-chip", text: "Open the family tree" });
    all.onclick = () => this.go({ kind: "family-tree" });
  }

  /** the chapter you were in, as a card like this week's lesson; the two
   * before it as chips. Nothing when the reader has never opened a chapter. */
  private renderContinue(slot: HTMLElement): void {
    const cur = this.host.lastChapter();
    if (!cur) { slot.remove(); return; }
    const card = slot.createDiv({ cls: "sg-cfm sg-continue" });
    card.createDiv({ cls: "sg-cfm-eyebrow", text: "Continue reading" });
    card.createDiv({ cls: "sg-cfm-title", text: cur.title });
    card.onclick = () => this.host.openChapter(cur.title);
    const recent = this.host.recentChapters().filter(r => r.slug !== cur.slug).slice(0, 3);
    if (recent.length) {
      const chips = card.createDiv({ cls: "sg-cfm-chips" });
      for (const r of recent) {
        const b = chips.createEl("button", { cls: "sg-cfm-chip", text: r.title });
        b.onclick = (e) => { e.stopPropagation(); this.host.openChapter(r.title); };
      }
    }
  }

  // ------------------------------------------------- scriptures & drilling

  private renderScriptures(c: HTMLElement): void {
    this.coverSeq = 0;
    // Scripture collections, first and biggest.
    c.createDiv({ cls: "sg-nav-sect sg-lib-sect", text: "Scriptures" });
    const grid = c.createDiv({ cls: "sg-nav-covers" });
    for (const vol of VOLUMES) {
      this.cover(grid, { icon: vol.icon, label: vol.name,
        photo: vol.name === ENOCH_VOLUME ? 'book-of-enoch' : vol.name === COMMANDMENTS_VOLUME ? 'book-of-commandments' : undefined, onTap: () => {
        const books = BOOKS.filter(b => b.volume === vol.name);
        this.go(books.length === 1
          ? { kind: "chapters", book: books[0]! }
          : { kind: "books", volume: vol.name });
      } });
    }
    // Study: the tools that work across the scriptures
    c.createDiv({ cls: "sg-nav-sect sg-lib-sect", text: "Study" });
    const study = c.createDiv({ cls: "sg-nav-covers" });
    this.cover(study, { icon: 'book-of-mormon', photo: 'come-follow-me', label: 'Come, Follow Me',
      onTap: () => this.go({ kind: 'folder', path: CFM_FOLDER, title: 'Come, Follow Me' }) });
    this.cover(study, { icon: 'book-of-mormon', photo: 'sunday-lessons', label: 'Sunday Lessons',
      onTap: () => this.go({ kind: 'folder', path: `${LIBRARY_PREFIX}08 Sunday Lessons`, title: 'Sunday Lessons' }) });
    this.cover(study, { icon: "folder", photo: "my-work", label: "My work", onTap: () => this.go({ kind: 'work' }) });
    this.cover(study, { icon: "page", photo: "textual-criticism", label: "My highlights & notes", onTap: () => this.showMarks() });
    this.cover(study, { icon: "hub", label: "Study Hub", onTap: () => this.host.openNote("Study Hub") });
    this.cover(study, { icon: "question", label: "Hard Questions", onTap: () => this.go({ kind: "questions" }) });
    this.cover(study, { icon: "timeline", photo: 'timeline-history', label: "Timeline", onTap: () => this.go({ kind: "timelines" }) });
    this.cover(study, { icon: "graph", label: "Graphs", onTap: () => this.go({ kind: "graphs" }) });
    this.cover(study, { icon: "place", photo: "maps", label: "Maps", onTap: () => this.go({ kind: "maps" }) });
    this.cover(study, { icon: 'photos', photo: 'photos', label: 'Photos', onTap: () => this.go({ kind: 'photos' }) });
    // Reference: the shelves — a shelf with nothing on it yet has no cover
    const shelves = LIBRARY_SECTIONS.filter(s => {
      const l = this.host.listFolder(s.path);
      const real = l.files.filter(f => f.name !== s.name && f.name !== s.name.split(" &")[0]);
      return l.folders.length || real.length;
    });
    if (shelves.length) {
      c.createDiv({ cls: "sg-nav-sect sg-lib-sect", text: "Reference" });
      const ref = c.createDiv({ cls: "sg-nav-covers" });
      for (const s of shelves) {
        // a shelf wears its own picture (covers/<its name>.jpg) before its icon's
        this.cover(ref, { icon: s.icon, label: s.name, photo: coverKey(s.name), fallbackPhoto: s.icon,
          onTap: () => this.go(s.name === "Family" ? { kind: "family" } : { kind: "folder", path: s.path, title: s.name }) });
      }
    }
    // Music: hymns, the children's songs, the family's playlists
    {
      c.createDiv({ cls: "sg-nav-sect sg-lib-sect", text: "Music" });
      const music = c.createDiv({ cls: "sg-nav-covers" });
      this.cover(music, { icon: "podcast", label: "Music", photo: "hymns", onTap: () => this.go({ kind: "music" }) });
      this.cover(music, { icon: "podcast", label: "Hymns", photo: "hymnbook", onTap: () => this.go({ kind: "hymns" }) });
      this.cover(music, { icon: "podcast", label: "Children's Songs", photo: "music-family",
        onTap: () => this.go({ kind: "hymns", book: "Children's Songbook" }) });
    }
  }

  private renderBooks(c: HTMLElement, volume: string): void {
    if (volume === ENOCH_VOLUME) { renderEnochChapters(c, path => this.host.openPath(path)); return; }
    if (volume === COMMANDMENTS_VOLUME) { renderCommandmentsChapters(c, path => this.host.openPath(path)); return; }
    const grid = c.createDiv({ cls: "sg-nav-books" });
    let i = 0;
    for (const b of BOOKS.filter(x => x.volume === volume)) {
      const pill = grid.createEl("button", { cls: "sg-nav-book", text: b.name });
      cascade(pill, i++);
      pill.onclick = () => this.go({ kind: "chapters", book: b });
    }
  }

  private renderChapters(c: HTMLElement, book: BookInfo): void {
    const cur = this.host.lastChapter();
    const grid = c.createDiv({ cls: "sg-nav-chapters" });
    for (let n = 1; n <= book.chapters; n++) {
      const btn = grid.createEl("button", { cls: "sg-nav-ch", text: String(n) });
      cascade(btn, Math.floor((n - 1) / 6));
      if (cur?.slug === `${book.slug}-${n}`) btn.addClass("sg-nav-ch-now");
      btn.onclick = () => this.host.openChapter(`${book.prefix} ${n}`);
    }
  }

  // ---------------------------------------------------------------- graphs

  /** 🕸 The Graphs shelf — every row is a pre-filtered graph the GPU can
   * actually hold. Tap one and the graph view opens already tamed. */
  private renderGraphs(c: HTMLElement): void {
    c.createDiv({
      cls: "sg-gp-note",
      text: "The whole vault is 10,000 pages and 75,000 links — far past what "
        + "one graph can draw. These views arrive already filtered.",
    });
    const list = c.createDiv({ cls: "sg-nav-list" });
    let i = 0;
    for (const p of GRAPH_PRESETS) {
      const row = list.createDiv({ cls: "sg-nav-row sg-gp-row" });
      cascade(row, i++);
      navIcon(row, p.icon);
      const col = row.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: p.name });
      col.createDiv({
        cls: "sg-nav-gsub",
        // phones get the trimmed view — say so on the shelf, not after
        text: (Platform.isMobile && p.mobile?.note) || p.desc,
      });
      row.createSpan({ cls: `sg-gp-weight sg-gp-${p.weight}`, text: p.weight });
      row.onclick = () => void openGraphPreset(this.app, p);
    }
  }

  // ------------------------------------------------------------- timelines

  /** 🕰 The Timelines shelf — the main chronologies ready to open, plus the
   * ones you build yourself: any person, place or thing, alone or overlapped. */
  private renderTimelines(c: HTMLElement): void {
    const intro = c.createDiv({ cls: 'sg-timeline-intro' });
    intro.createDiv({ cls: 'sg-timeline-eyebrow', text: 'A journey through scripture' });
    intro.createEl('h2', { text: 'History, connected.' });
    intro.createEl('p', { text: 'Follow people, places, and the moments that bring their stories together. Open a timeline, then choose Full screen to explore.' });
    let i = 0;
    const row = (list: HTMLElement, icon: NavIconName, name: string,
      sub: string, onTap: () => void): HTMLElement => {
      const r = list.createDiv({ cls: "sg-nav-row" });
      cascade(r, i++);
      navIcon(r, icon);
      const col = r.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: name });
      col.createDiv({ cls: "sg-nav-gsub", text: sub });
      r.onclick = onTap;
      return r;
    };
    c.createDiv({ cls: "sg-nav-sect", text: "The main timelines" });
    const main = c.createDiv({ cls: "sg-nav-covers" });
    this.coverSeq = 0;
    this.cover(main, { icon: 'timeline', photo: 'timeline-history', label: 'The Whole Story', onTap: () => this.host.openTimelinePreset({}) });
    this.cover(main, { icon: 'old-testament', photo: 'bible', label: 'Bible', onTap: () => this.host.openTimelinePreset({ title: 'Bible', lanes: ['ow'] }) });
    this.cover(main, { icon: 'book-of-mormon', photo: 'book-of-mormon', label: 'Book of Mormon', onTap: () => this.host.openTimelinePreset({ title: 'Book of Mormon', lanes: ['nw'] }) });
    this.cover(main, { icon: 'history', photo: 'restoration', label: 'Restoration', onTap: () => this.host.openTimelinePreset({ title: 'Restoration', lanes: ['rs'] }) });
    // yours: saved subject mixes — "Nephi" alone, or "Nephi AND Daniel"
    c.createDiv({ cls: "sg-nav-sect", text: "Your timelines" });
    const mine = c.createDiv({ cls: "sg-nav-list" });
    for (const t of this.s.device.myTimelines ?? []) {
      const solo = t.subjects.length === 1 && t.subjects[0]!.kind === "people";
      const r = row(mine, solo ? "person" : "groups", t.name,
        t.subjects.map(x => x.name).join(" · "),
        () => this.host.openTimelinePreset({ title: t.name, subjects: t.subjects }));
      const del = r.createEl("button", { cls: "sg-tls-del", text: "✕" });
      del.setAttr("aria-label", `Delete ${t.name}`);
      del.onclick = (e) => {
        e.stopPropagation();
        this.s.device.myTimelines =
          (this.s.device.myTimelines ?? []).filter(x => x.name !== t.name);
        void this.s.saveDevice();
        this.render();
      };
    }
    row(mine, "event", "New timeline",
      "People, places, events, gospel topics, records and more",
      () => this.host.newTimeline(() => this.render()));
  }

  /** ❓ The Hard Questions shelf — every question page, the Restoration's
   * and Christianity's, each handled the same honest way: the strongest
   * case for, the strongest case against, and an assessment that says what
   * is established, what is open, and what is a matter of faith. Seeded
   * pages deepen into researched dossiers once the whole canon is read. */
  private renderQuestions(c: HTMLElement): void {
    c.createDiv({
      cls: "sg-gp-note",
      text: "Serious questions deserve serious, sourced answers — the strongest "
        + "case for, the strongest case against, and an honest assessment of "
        + "where that leaves things.",
    });
    const listing = this.host.listFolder(QUESTIONS_PATH);
    const rows = listing.files
      .map(f => ({ ...f, name: f.name.replace(/\.md$/, "") }))
      .filter(f => f.name !== "Questions")
      .map(f => {
        const fm = (this.app.metadataCache.getCache(f.path)?.frontmatter ?? {}) as
          Record<string, unknown>;
        return { ...f,
          scope: String(fm.scope ?? QUESTION_SCOPE_BY_TITLE[f.name] ?? "more"),
          status: String(fm.status ?? "") };
      });
    let i = 0;
    const group = (label: string, scope: string) => {
      const mine = rows.filter(r => r.scope === scope);
      if (!mine.length) return;
      c.createDiv({ cls: "sg-nav-sect", text: label });
      const list = c.createDiv({ cls: "sg-nav-list" });
      for (const r of mine) {
        const row = list.createDiv({ cls: "sg-nav-row sg-hq-row" });
        cascade(row, i++);
        navIcon(row, "question");
        const col = row.createDiv({ cls: "sg-nav-gcol" });
        col.createDiv({ cls: "sg-nav-name", text: r.name });
        col.createDiv({
          cls: "sg-nav-gsub",
          text: r.status.startsWith("developed")
            ? "Researched dossier — evidence, objections, honest assessment"
            : r.status.startsWith("queued")
              ? "In the research queue — written from the vault's own findings"
              : "Seeded answer — the research pass deepens it",
        });
        row.onclick = () => this.host.openPath(r.path);
      }
    };
    group("Church History & the Restoration", "restoration");
    group("The Book of Mormon", "book-of-mormon");
    group("The Bible & Christianity", "christianity");
    group("More questions", "more");
    if (!rows.length) {
      c.createDiv({ cls: "sg-nav-empty", text: "No question pages have synced yet." });
    }
  }

  private isLibraryRoot(path: string): boolean {
    return ['AI Library', 'AI Library/01 Scriptures'].includes(path.replace(/\\/g, '/').replace(/\/+$/, ''));
  }

  private renderFolder(c: HTMLElement, path: string): void {
    if (this.isLibraryRoot(path)) { this.renderScriptures(c); return; }
    if (path === CFM_FOLDER || path.startsWith(CFM_FOLDER + '/')) this.coverSeq = 0;
    if (renderComeFollowMeShelf(c, path, CFM_FOLDER, {
      listFolder: p => this.host.listFolder(p), openPath: p => this.host.openPath(p),
      go: (p, title) => this.go({kind:'folder',path:p,title}),
      cover: (grid, label, onTap) => this.cover(grid, {icon:'book-of-mormon',photo:CFM_MONTH_ART[label] ?? 'come-follow-me',fallbackPhoto:'come-follow-me',label,onTap}),
      offline: (parent, yearPath) => {
        if (!this.host.downloadFolder || !this.host.remoteCount?.(yearPath)) return;
        const details = parent.createEl('details', {cls:'sg-collection-offline'});
        details.createEl('summary', {text:'Offline reading'});
        const download = details.createEl('button',{text:'Download this year'});
        download.onclick = () => {
          download.disabled = true; download.setText('Downloading…');
          void this.host.downloadFolder!(yearPath).then(() => { new Notice('Downloaded'); this.render(); })
            .catch(() => { download.disabled = false; download.setText('Try download again'); });
        };
      },
    })) return;
    if (path.endsWith('/Words of the Prophets')) {
      this.renderProphetsShelf(c, path);
      return;
    }
    const listing = this.host.listFolder(path);
    const yearish = listing.folders.length > 3
      && listing.folders.every(f => /^\d{4}$/.test(f.name));
    // Reading parts belong inside their book's contents page, not beside books.
    const visibleFolders = listing.folders.filter(f => f.name !== 'Full Text' && !f.name.startsWith('_'));
    const folders = yearish ? [...visibleFolders].reverse() : visibleFolders;
    // the nearest ancestor's art, for sub-shelves that have none of their
    // own (a conference year, April, October all wear the conference photo)
    const shelfPhoto = this.inheritedPhoto(path);
    const tile = (grid: HTMLElement, f: { name: string; path: string }) =>
      this.cover(grid, { icon: "folder", label: f.name.replace(/^\d{2}\s+(?=\D)/, ''), photo: coverKey(f.name.replace(/^\d{2}\s+(?=\D)/, '')), fallbackPhoto: shelfPhoto,
        stamp: yearish ? f.name : undefined,
        onTap: () => this.go({ kind: "folder", path: f.path, title: f.name }) });
    // sub-shelves are tiles, like everything else on the shelf — a photo
    // when the vault has one for that name (covers/<slug>.jpg), the shelf's
    // photo otherwise. Years (a conference archive) are tiles too, but they
    // live under the filter box since there are a hundred of them.
    const events = path === `${LIBRARY_PREFIX}05 Events`;
    if ((folders.length || events) && !yearish) {
      this.coverSeq = 0;
      const grid = c.createDiv({ cls: "sg-nav-covers" });
      if (events) this.cover(grid, { icon: 'folder', label: 'Event Backgrounds', photo: 'event-backgrounds',
        onTap: () => this.go({ kind: 'event-backgrounds' }) });
      for (const f of folders) tile(grid, f);
    }
    // pages still on the server: one button keeps the whole shelf here
    const remoteN = this.host.remoteCount?.(path) ?? 0;
    if (remoteN && this.host.downloadFolder) {
      const dl = c.createEl("button", { cls: "sg-nav-dl", text: `⤓ Keep this shelf on this phone (${remoteN} pages)` });
      dl.onclick = () => {
        dl.setText("Downloading…"); dl.setAttribute("disabled", "true");
        void this.host.downloadFolder!(path).then(() => { new Notice("Downloaded"); this.render(); });
      };
    }
    let filter = "";
    const list = c.createDiv({ cls: "sg-nav-list" });
    const renderRows = () => {
      list.empty();
      const q = filter.toLowerCase();
      let i = 0;
      if (yearish) {
        this.coverSeq = 0;
        const grid = list.createDiv({ cls: "sg-nav-covers sg-nav-years" });
        for (const f of folders) {
          if (q && !f.name.toLowerCase().includes(q)) continue;
          tile(grid, f);
        }
        if (!grid.childElementCount) grid.remove();
      }
      for (const fi of listing.files) {
        if (q && !fi.name.toLowerCase().includes(q)) continue;
        // the shelf's own index page is the shelf; it is not a row on it
        if (fi.name === (this.view.kind === "folder" ? this.view.title : "") ) continue;
        const row = list.createDiv({ cls: `sg-nav-row sg-nav-file${fi.remote ? " sg-nav-remote" : ""}` });
        cascade(row, i++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: fi.name });
        if (fi.remote) row.createSpan({ cls: "sg-nav-ext-dl", text: "⤓", attr: { "aria-label": "Fetched when opened" } });
        row.onclick = () => this.host.openPath(fi.path);
      }
      // a shelf of sub-shelves and no pages is not empty; only say so when
      // there is truly nothing, or the filter matched nothing
      if (!list.childElementCount && (q || (!folders.length && !events))) {
        list.createDiv({ cls: "sg-nav-empty", text: q ? "Nothing here matches." : "Nothing here yet." });
      }
    };
    if (folders.length + listing.files.length > 30) {
      const inp = c.createEl("input", {
        cls: "sg-nav-filter",
        attr: { type: "search", placeholder: "Type to filter…" },
      });
      inp.oninput = () => { filter = inp.value; renderRows(); };
      c.insertBefore(inp, list);
    }
    renderRows();
  }

  private renderProphetsShelf(c: HTMLElement, path: string): void {
    const section = (title: string) => {
      c.createEl('h3', { cls: 'sg-collection-heading', text: title });
      return c.createDiv({ cls: 'sg-collection-list' });
    };
    const row = (parent: HTMLElement, title: string, description: string, target: string, folder = true) => {
      const button = parent.createEl('button', { cls: 'sg-collection-row' });
      const copy = button.createSpan({ cls: 'sg-collection-copy' });
      copy.createSpan({ cls: 'sg-collection-title', text: title });
      copy.createSpan({ cls: 'sg-collection-description', text: description });
      button.createSpan({ text: '›', attr: { 'aria-hidden': 'true' } });
      button.onclick = () => folder ? this.go({ kind: 'folder', path: target, title }) : this.host.openPath(target);
    };
    const teachings = section('Teachings & writings');
    row(teachings, 'Teachings of Presidents', 'Browse teachings by Church president.', `${path}/Teachings of Presidents`);
    row(teachings, 'Journals and Writings', 'Books, journals, and autobiographies.', `${path}/Journals and Writings`);
    const records = section('Historical records');
    row(records, 'Joseph Smith Papers', 'Documents, journals, histories, and revelations.', `${path}/Joseph Smith Papers`);
    row(records, 'Patriarchal Blessings', 'Recorded blessings, historical accounts, and studies.', `${path}/Patriarchal Blessings (historical).md`, false);
    const related = section('Related collections');
    const history = path.slice(0, path.lastIndexOf('/'));
    row(related, 'Historical Sermons and Documents', 'King Follett and other Foundation source texts.', `${history}/Joseph Smith Foundation`);
    row(related, 'Periodicals', 'Historical newspapers, reports, and Church history.', `${history}/Periodicals`);
    // Keep offline controls available without interrupting the collections.
    if (this.host.downloadFolder && this.host.remoteCount?.(path)) {
      const details = c.createEl('details', { cls: 'sg-collection-offline' });
      details.createEl('summary', { text: 'Offline reading' });
      details.createEl('p', { text: 'Pages load as you open them. Download this shelf to read it without a connection.' });
      const button = details.createEl('button', { text: 'Download this shelf' });
      button.onclick = () => {
        button.disabled = true;
        button.setText('Downloading…');
        void this.host.downloadFolder!(path).then(() => { new Notice('Downloaded'); this.render(); })
          .catch(() => { button.disabled = false; button.setText('Try download again'); });
      };
    }
  }

  /** the photo a folder inherits: walk up from the folder to the shelf and
   * take the first covers/<slug>.jpg found ("2025/April" → conference) */
  private inheritedPhoto(path: string): string | undefined {
    if (path.startsWith(`${LIBRARY_PREFIX}08 Sunday Lessons`)) return 'come-follow-me';
    if (path === CFM_FOLDER || path.startsWith(`${CFM_FOLDER}/`)) return 'come-follow-me';
    if (path.startsWith(`${LIBRARY_PREFIX}01 Scriptures/Study Guides`)) return 'teachings';
    return inheritedCoverKey(path, LIBRARY_SECTIONS, key => !!BUNDLED_COVERS[key]
      || this.app.vault.getAbstractFileByPath(`${COVERS_PATH}/${key}.jpg`) instanceof TFile);
  }

  // ---------------------------------------------------------------- search

  private runSearch(q: string, body: HTMLElement): void {
    const seq = ++this.searchSeq;
    body.empty();
    const ref = parseReference(q);
    const scope = this.searchScope, volume = this.searchVolume;
    const refRow = ref ? filterLocal({ reference: ref, verses: [], pages: [], chapters: [] }, scope, volume).reference : undefined;
    if (refRow) this.renderResults({ reference: refRow, verses: [], pages: [], chapters: [] }, body.createDiv());
    const remote = body.createDiv({ cls: 'sg-nav-lib-hits' });
    const local = body.createDiv();
    const current = () => seq === this.searchSeq && this.view.kind === 'home';
    let localResults: SearchResults | undefined;
    let serverPaths = new Set<string>();
    const renderLocal = () => {
      if (current() && localResults) this.renderResults(filterLocal({ ...localResults, reference: undefined,
        pages: localResults.pages.filter(p => !serverPaths.has(p.path)) }, scope, volume), local);
    };
    void renderRemoteSearch(remote, q, query => this.s.api.search(query), current,
      hit => hit.path ? this.host.openPath(hit.path) : this.host.openNote(hit.title),
      hits => { serverPaths = new Set(hits.flatMap(h => h.path ? [h.path] : [])); renderLocal(); },
      scope === "all" ? undefined : hit => keepHit(hit, scope, volume));
    local.createDiv({ cls: 'sg-nav-progress', text: 'Searching downloaded pages…' });
    buildSearchIndex(this.app).then(index => {
      localResults = smartSearch(q, index); renderLocal();
    }).catch(() => { if (current()) { local.empty(); local.createDiv({ text: 'Local search is unavailable.' }); } });
  }

  private renderResults(res: SearchResults, body: HTMLElement): void {
    body.empty();
    if (!res.reference && !res.verses.length && !res.pages.length && !res.chapters.length) {
      body.createDiv({ cls: "sg-nav-empty", text: "No matches in downloaded pages." });
      return;
    }
    let ri = 0;
    if (res.reference) {
      body.createDiv({ cls: "sg-nav-sect", text: "Scriptures" });
    }
    if (res.reference) {
      const ref = res.reference;
      const row = body.createDiv({ cls: "sg-nav-row sg-nav-refrow" });
      cascade(row, ri++);
      navIcon(row, "target");
      const col = row.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: ref.verse !== null ? `${ref.title}:${ref.verse}` : ref.title });
      col.createDiv({ cls: "sg-nav-gsub", text: ref.verse !== null ? "Go to verse" : "Open chapter" });
      row.onclick = () => {
        if (ref.anchor) this.host.openNote(`${ref.title}#^${ref.anchor}`);
        else this.host.openChapter(ref.title);
      };
    }
    if (res.pages.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Downloaded library" });
      for (const p of res.pages) {
        const row = body.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, ri++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: p.title });
        row.onclick = () => this.host.openPath(p.path);
      }
    }
    if (res.verses.length) body.createDiv({ cls: "sg-nav-sect", text: "Scripture passages" });
    for (const v of res.verses) {
      const row = body.createDiv({ cls: "sg-nav-row sg-nav-vrow" });
      cascade(row, ri++);
      const col = row.createDiv({ cls: "sg-nav-vcol" });
      col.createDiv({ cls: "sg-nav-vref", text: `${v.chapter}:${v.verse}` });
      const snip = col.createDiv({ cls: "sg-nav-snip" });
      let at = 0;
      for (const r of v.ranges) {
        if (r.start > at) snip.createSpan({ text: v.snippet.slice(at, r.start) });
        snip.createEl("b", { text: v.snippet.slice(r.start, r.end) });
        at = r.end;
      }
      if (at < v.snippet.length) snip.createSpan({ text: v.snippet.slice(at) });
      row.onclick = () => this.host.openNote(`${v.chapter}#^${v.anchor}`);
    }
    if (res.chapters.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Chapters" });
      for (const ch of res.chapters) {
        const row = body.createDiv({ cls: "sg-nav-row" });
        cascade(row, ri++);
        navIcon(row, "chapter");
        row.createSpan({ cls: "sg-nav-name", text: ch.title });
        row.createSpan({ cls: "sg-nav-chev", text: "›" });
        row.onclick = () => this.host.openChapter(ch.title);
      }
    }
  }
}
