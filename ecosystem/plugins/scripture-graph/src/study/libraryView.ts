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
import { buildSearchIndex, searchIndexReady, smartSearch, type SearchResults } from "./search";
import { AddSongModal, songsOn } from "./addSong";

export const LIBRARY_VIEW = "sg-library";

type LibView =
  | { kind: "home" }
  | { kind: "scriptures" }
  | { kind: "books"; volume: string }
  | { kind: "chapters"; book: BookInfo }
  | { kind: "graphs" }
  | { kind: "timelines" }
  | { kind: "questions" }
  | { kind: "hymns"; book?: string }
  | { kind: "music" }
  | { kind: "playlist"; key: string; title: string }
  | { kind: "folder"; path: string; title: string };

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

/** covers/<key>.jpg for a shelf name: "Revelations in Context" →
 * revelations-in-context; a few names share art with a home cover */
const COVER_ALIAS: Record<string, string> = {
  "bible-dictionary": "dictionary", "joseph-smith-papers": "papers", "general-conference": "conference",
  "words-of-the-prophets": "prophets", "journals-and-writings": "journals",
  "teachings-of-presidents": "teachings", "revelations-in-context": "revelations",
  // folder names that share a home shelf's art
  "gospel-topics": "topics", "people": "person", "places": "place", "events": "event",
  "doctrines": "doctrine", "findings": "evidence", "questions": "question", "church-history": "history",
  "scriptures": "bible", "secondary-sources": "podcast", "reference": "dictionary", "topical-guide": "dictionary",
  "essays": "scholarship", "true-to-the-faith": "doctrine", "ai-study-guides": "hub",
  "sources": "papers", "manifests": "papers", "source-notes": "papers", "periodicals": "periodicals",
  "harold-b-lee": "teachings", "music": "hymns",
};
function coverKey(name: string): string {
  const slug = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return COVER_ALIAS[slug] ?? slug;
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
    // the "‹ <chapter>" pill has a Continue card here already; off the title
    document.body.addClass("sg-lib-open");
    this.render();
  }

  async onClose(): Promise<void> {
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
    this.view = v;
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
    if (this.view.kind === "hymns") return this.view.book === "Children's Songbook" ? "Children's Songs" : "Hymns";
    if (this.view.kind === "music") return "Music";
    if (this.view.kind === "playlist") return this.view.title;
    const v = this.view;
    return v.kind === "home" ? "Library"
      : v.kind === "scriptures" ? "Scriptures"
        : v.kind === "books" ? v.volume
          : v.kind === "chapters" ? v.book.name
            : v.kind === "graphs" ? "Graphs"
              : v.kind === "timelines" ? "Timelines"
                : v.kind === "questions" ? "Hard Questions"
                  : v.title;
  }

  private unsubs: (() => void)[] = [];

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
    const v = this.view;
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
    head.createDiv({ cls: "sg-lp-title", text: this.title() });

    // the dock lights the door you are behind — home, the shelf, or search
    window.setTimeout(() => document.dispatchEvent(new CustomEvent("sg-dock-refresh")), 0);
    const body = c.createDiv({ cls: "sg-lp-body" });
    if (v.kind === "home") this.renderHome(body);
    else if (v.kind === "scriptures") this.renderScriptures(body);
    else if (v.kind === "books") this.renderBooks(body, v.volume);
    else if (v.kind === "chapters") this.renderChapters(body, v.book);
    else if (v.kind === "graphs") this.renderGraphs(body);
    else if (v.kind === "timelines") this.renderTimelines(body);
    else if (v.kind === "questions") this.renderQuestions(body);
    else if (v.kind === "hymns") void this.renderHymns(body, v.book);
    else if (v.kind === "music") void this.renderMusic(body);
    else if (v.kind === "playlist") void this.renderPlaylist(body, v.key);
    else this.renderFolder(body, v.path);
  }

  /** which dock door this page sits behind */
  dockSlot(): "home" | "library" | "search" {
    if (this.view.kind !== "home") return "library";
    return this.searchQuery.trim() ? "search" : "home";
  }

  /** the Scriptures shelf — GL's "Library" tab is the shelf of books */
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
    const f = this.s.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) { this.host.openPath(path); return; }
    new Notice("This week's lesson is still downloading to this device — syncing now.", 6000);
    (this.s.app as unknown as { commands?: { executeCommandById?: (id: string) => void } })
      .commands?.executeCommandById?.("scripture-graph:vault-sync-now");
  }

  private async renderThisWeek(slot: HTMLElement): Promise<void> {
    const f = this.app.vault.getAbstractFileByPath(CFM_PATH);
    if (!(f instanceof TFile)) return;
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
    const f = this.app.vault.getAbstractFileByPath(HYMNS_PATH);
    if (!(f instanceof TFile)) return [];
    try {
      const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
      return m ? (JSON.parse(m[1]!) as Hymn[]) : [];
    } catch { return []; }
  }

  private async loadPlaylists(): Promise<Playlist[]> {
    const f = this.app.vault.getAbstractFileByPath(MUSIC_PATH);
    if (!(f instanceof TFile)) return [];
    try {
      const m = /```json\s*([\s\S]*?)```/.exec(await this.app.vault.cachedRead(f));
      return m ? ((JSON.parse(m[1]!) as { playlists?: Playlist[] }).playlists ?? []) : [];
    } catch { return []; }
  }

  /** cover art as a resource url, when the vault has it */
  private art(key: string): string | undefined {
    const f = this.app.vault.getAbstractFileByPath(`AI Library/00 System/covers/${key}.jpg`);
    return f instanceof TFile ? this.app.vault.getResourcePath(f) : undefined;
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
        onTap: () => this.go({ kind: "playlist", key: pl.key, title: pl.title }) });
    }
    if (!lists.length) c.createDiv({ cls: "sg-nav-empty", text: "The playlists have not synced yet." });
  }

  /** the hymnbook (or the Children's Songbook): search, tap to play */
  private async renderHymns(c: HTMLElement, book?: string): Promise<void> {
    const all = await this.loadHymns();
    if (!c.isConnected) return;
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

  // ------------------------------------------------------- did you notice?

  private insightPool: Insight[] | null = null;

  private async loadInsights(): Promise<Insight[]> {
    if (this.insightPool) return this.insightPool;
    const f = this.app.vault.getAbstractFileByPath(INSIGHTS_PATH);
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
    // a photo, when the vault has one for this shelf: lazy — the card paints
    // at once in its plain hue and the image fades in when it scrolls into
    // view. `covers/<key>.jpg` is ~40 KB at 480 px; drop your own to replace.
    const key = opts.photo ?? (opts.jacket ? "scriptures" : opts.icon);
    let photo = key ? this.app.vault.getAbstractFileByPath(`${COVERS_PATH}/${key}.jpg`) : null;
    if (!(photo instanceof TFile) && opts.fallbackPhoto) photo = this.app.vault.getAbstractFileByPath(`${COVERS_PATH}/${opts.fallbackPhoto}.jpg`);
    if (photo instanceof TFile) {
      const img = art.createEl("img", { cls: "sg-nav-cover-photo",
        attr: { loading: "lazy", decoding: "async", alt: "" } });
      img.src = this.app.vault.getResourcePath(photo);
      img.onload = () => art.addClass("sg-has-photo");
    }
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
    const body = c.createDiv({ cls: "sg-nav-searchhost" });
    const showHome = () => {
      this.searchSeq++;
      body.empty();
      this.renderShelf(body);
    };
    inp.oninput = () => {
      this.searchQuery = inp.value;
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
    if (q0.length >= 2) this.runSearch(q0, body);
    else this.renderShelf(body);
  }

  private renderShelf(c: HTMLElement): void {
    this.coverSeq = 0;
    // (Continue reading + recent chapters left the home page 2026-09-06 —
    // the dock's Saved sheet carries them; the home leads with the insight)
    // 📅 Come, Follow Me — this week, from the engine's index
    void this.renderThisWeek(c.createDiv({ cls: "sg-cfm-slot" }));
    // ✦ Did you notice? — one deep, faith-building connection a day
    void this.renderInsight(c.createDiv({ cls: "sg-insight-slot" }));
    // the shelf, GL's top level: Scriptures is ONE cover — the black jacket
    // with the four works stamped in gold down its front, like the photo
    const grid = c.createDiv({ cls: "sg-nav-covers" });
    this.cover(grid, {
      label: "Scriptures", hue: "#d9c07a", jacket: "sg-cover-jacket",
      lines: ["Holy Bible", "Book of Mormon", "Doctrine and Covenants", "Pearl of Great Price"],
      onTap: () => this.go({ kind: "scriptures" }),
    });
    this.cover(grid, { icon: "timeline", label: "Timeline",
      onTap: () => this.go({ kind: "timelines" }) });
    this.cover(grid, { icon: "hub", label: "Study Hub",
      onTap: () => this.host.openNote("Study Hub") });
    this.cover(grid, { icon: "graph", label: "Graphs",
      onTap: () => this.go({ kind: "graphs" }) });
    this.cover(grid, { icon: "question", label: "Hard Questions",
      onTap: () => this.go({ kind: "questions" }) });
    if (this.app.vault.getAbstractFileByPath(HYMNS_PATH)) {
      this.cover(grid, { icon: "podcast", label: "Music", photo: "hymns",
        onTap: () => this.go({ kind: "music" }) });
    }
    for (const s of LIBRARY_SECTIONS) {
      const l = this.host.listFolder(s.path);
      // a shelf whose only page is its own index (Scholarship before any
      // paper is dropped in) is an empty shelf: no cover until it has content
      const real = l.files.filter(f => f.name !== s.name && f.name !== s.name.split(" &")[0]);
      if (!l.folders.length && !real.length) continue;
      this.cover(grid, { icon: s.icon, label: s.name,
        onTap: () => this.go({ kind: "folder", path: s.path, title: s.name }) });
    }
    // what the family is studying — quiet rows beneath the shelf
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
  }

  // ------------------------------------------------- scriptures & drilling

  private renderScriptures(c: HTMLElement): void {
    this.coverSeq = 0;
    const grid = c.createDiv({ cls: "sg-nav-covers" });
    for (const vol of VOLUMES) {
      this.cover(grid, { icon: vol.icon, label: vol.name, onTap: () => {
        const books = BOOKS.filter(b => b.volume === vol.name);
        this.go(books.length === 1
          ? { kind: "chapters", book: books[0]! }
          : { kind: "books", volume: vol.name });
      } });
    }
  }

  private renderBooks(c: HTMLElement, volume: string): void {
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
    const main = c.createDiv({ cls: "sg-nav-list" });
    row(main, "timeline", "The Whole Story",
      "Every lane, every era — the full chronology",
      () => this.host.openTimelinePreset({}));
    row(main, "old-testament", "Bible", "The Old World lane on its own",
      () => this.host.openTimelinePreset({ title: "Bible", lanes: ["ow"] }));
    row(main, "book-of-mormon", "Book of Mormon", "The New World lane on its own",
      () => this.host.openTimelinePreset({ title: "Book of Mormon", lanes: ["nw"] }));
    row(main, "history", "Restoration", "The Restoration lane on its own",
      () => this.host.openTimelinePreset({ title: "Restoration", lanes: ["rs"] }));
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
      "Pick a person, place or thing — or overlap several",
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

  private renderFolder(c: HTMLElement, path: string): void {
    const listing = this.host.listFolder(path);
    const yearish = listing.folders.length > 3
      && listing.folders.every(f => /^\d{4}$/.test(f.name));
    const folders = yearish ? [...listing.folders].reverse() : listing.folders;
    // the nearest ancestor's art, for sub-shelves that have none of their
    // own (a conference year, April, October all wear the conference photo)
    const shelfPhoto = this.inheritedPhoto(path);
    const tile = (grid: HTMLElement, f: { name: string; path: string }) =>
      this.cover(grid, { icon: "folder", label: f.name, photo: coverKey(f.name), fallbackPhoto: shelfPhoto,
        stamp: yearish ? f.name : undefined,
        onTap: () => this.go({ kind: "folder", path: f.path, title: f.name }) });
    // sub-shelves are tiles, like everything else on the shelf — a photo
    // when the vault has one for that name (covers/<slug>.jpg), the shelf's
    // photo otherwise. Years (a conference archive) are tiles too, but they
    // live under the filter box since there are a hundred of them.
    if (folders.length && !yearish) {
      this.coverSeq = 0;
      const grid = c.createDiv({ cls: "sg-nav-covers" });
      for (const f of folders) tile(grid, f);
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
        const row = list.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, i++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: fi.name });
        row.onclick = () => this.host.openPath(fi.path);
      }
      // a shelf of sub-shelves and no pages is not empty; only say so when
      // there is truly nothing, or the filter matched nothing
      if (!list.childElementCount && (q || !folders.length)) {
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

  /** the photo a folder inherits: walk up from the folder to the shelf and
   * take the first covers/<slug>.jpg found ("2025/April" → conference) */
  private inheritedPhoto(path: string): string | undefined {
    const has = (key: string) => this.app.vault.getAbstractFileByPath(`${COVERS_PATH}/${key}.jpg`) instanceof TFile;
    const parts = path.split("/");
    for (let n = parts.length; n > 0; n--) {
      const here = parts.slice(0, n).join("/");
      const name = parts[n - 1]!.replace(/^\d+\s+/, "");
      const shelf = LIBRARY_SECTIONS.find(sec => sec.path === here);
      for (const key of [coverKey(name), shelf?.icon, shelf ? coverKey(shelf.name) : undefined]) {
        if (key && has(key)) return key;
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------- search

  private runSearch(q: string, body: HTMLElement): void {
    const seq = ++this.searchSeq;
    const fail = () => {
      if (seq !== this.searchSeq || this.view.kind !== "home") return;
      body.empty();
      body.createDiv({ cls: "sg-nav-progress", text: "Search isn't available right now." });
    };
    if (!searchIndexReady()) {
      body.empty();
      const prog = body.createDiv({ cls: "sg-nav-progress", text: "Reading the scriptures… 0%" });
      buildSearchIndex(this.app, (done, total) => {
        const pct = total ? Math.round((done / total) * 100) : 100;
        prog.setText(`Reading the scriptures… ${pct}%`);
      }).then(index => {
        if (seq !== this.searchSeq || this.view.kind !== "home") return;
        this.renderResults(smartSearch(q, index), body);
      }).catch(fail);
      return;
    }
    buildSearchIndex(this.app).then(index => {
      if (seq !== this.searchSeq || this.view.kind !== "home") return;
      this.renderResults(smartSearch(q, index), body);
      void this.renderLibraryHits(q, body, seq);
    }).catch(fail);
  }

  /** the whole library — talks, teachings, periodicals, questions, every
   * indexed passage — answered by the family server from the engine's
   * index. Shown beneath the local results; quiet when unreachable. */
  private async renderLibraryHits(q: string, body: HTMLElement, seq: number): Promise<void> {
    if (q.length < 3 || !this.s.device.deviceToken) return;
    const holder = body.createDiv({ cls: "sg-nav-lib-hits" });
    holder.createDiv({ cls: "sg-nav-sect", text: "From the library" });
    const prog = holder.createDiv({ cls: "sg-nav-progress", text: "Searching every passage…" });
    try {
      const { results } = await this.s.api.search(q);
      if (seq !== this.searchSeq || !holder.isConnected) return;
      prog.remove();
      if (!results.length) { holder.createDiv({ cls: "sg-nav-empty", text: "No passages match." }); return; }
      const list = holder.createDiv({ cls: "sg-nav-list" });
      let i = 0;
      for (const r of results) {
        const row = list.createDiv({ cls: "sg-nav-row sg-nav-hit" });
        cascade(row, i++);
        navIcon(row, r.kind === "scripture" ? "verse" : "page");
        const col = row.createDiv({ cls: "sg-nav-gcol" });
        col.createDiv({ cls: "sg-nav-name", text: r.title });
        const snip = col.createDiv({ cls: "sg-nav-snip" });
        // «term» marks from the index become emphasis
        for (const part of r.snippet.split(/(«[^»]*»)/)) {
          if (part.startsWith("«")) snip.createEl("mark", { cls: "sg-nav-hl", text: part.slice(1, -1) });
          else snip.appendText(part);
        }
        row.onclick = () => {
          if (r.path) this.host.openPath(r.path.replace(/\.md$/, ""));
          else this.host.openNote(r.title);
        };
      }
    } catch {
      if (!holder.isConnected) return;
      prog.setText("Library search needs the family server (home Wi-Fi).");
    }
  }

  private renderResults(res: SearchResults, body: HTMLElement): void {
    body.empty();
    if (!res.reference && !res.verses.length && !res.pages.length && !res.chapters.length) {
      body.createDiv({ cls: "sg-nav-empty", text: "Nothing found. Try fewer or different words." });
      return;
    }
    let ri = 0;
    if (res.reference || res.verses.length) {
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
    if (res.pages.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Library" });
      for (const p of res.pages) {
        const row = body.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, ri++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: p.title });
        row.onclick = () => this.host.openPath(p.path);
      }
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
