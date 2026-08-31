/** 🏛 The Library PAGE — Gospel Library's architecture, our craft.
 *
 * Not a modal anymore: a full workspace view, the way Gospel Library's
 * Library tab owns the whole screen. Top-down: a big left-aligned title
 * with a back chevron when drilled, the smart search, the Continue hero,
 * then the SHELF — a grid of cover cards with the stacked-deck lines GL
 * puts above each one. The Scriptures cover is the photo's black jacket
 * with the four works gold-stamped down its front; it drills to the five
 * volume covers, then books, then the chapter grid — GL's exact rhythm. */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { BOOKS, type BookInfo } from "@scripture-graph/core-sdk";
import { SGState } from "../state";
import { cascade, iconHue, navIcon, type NavIconName } from "./navIcons";
import { LIBRARY_SECTIONS, VOLUMES, titleForChapterSlug, type NavigatorHost } from "./navigator";
import { buildSearchIndex, searchIndexReady, smartSearch, type SearchResults } from "./search";

export const LIBRARY_VIEW = "sg-library";

type LibView =
  | { kind: "home" }
  | { kind: "scriptures" }
  | { kind: "books"; volume: string }
  | { kind: "chapters"; book: BookInfo }
  | { kind: "folder"; path: string; title: string };

export class SGLibraryView extends ItemView {
  private view: LibView = { kind: "home" };
  private trail: LibView[] = [];
  private searchQuery = "";
  private searchTimer: number | null = null;
  private searchSeq = 0;
  private groupActs: { group_name: string; chapter_slug: string; count: number; others: number }[] | null = null;

  constructor(leaf: WorkspaceLeaf, private s: SGState, private host: NavigatorHost) {
    super(leaf);
  }

  getViewType(): string { return LIBRARY_VIEW; }
  getDisplayText(): string { return "Library"; }
  getIcon(): string { return "library"; }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("sg-libpage");
    this.render();
  }

  async onClose(): Promise<void> {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.contentEl.empty();
  }

  private go(v: LibView): void {
    this.trail.push(this.view);
    this.view = v;
    this.render();
  }

  private back(): void {
    const prev = this.trail.pop();
    if (prev) { this.view = prev; this.render(); return; }
    const v = this.view;
    this.view = v.kind === "chapters" ? { kind: "books", volume: v.book.volume }
      : v.kind === "books" ? { kind: "scriptures" }
        : { kind: "home" };
    this.render();
  }

  private title(): string {
    const v = this.view;
    return v.kind === "home" ? "Library"
      : v.kind === "scriptures" ? "Scriptures"
        : v.kind === "books" ? v.volume
          : v.kind === "chapters" ? v.book.name
            : v.title;
  }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    const v = this.view;
    // GL's top-down header: chevron circle, then the big left-aligned title
    const head = c.createDiv({ cls: "sg-lp-head" });
    if (v.kind !== "home") {
      const back = head.createEl("button", { cls: "sg-nav-btn sg-lp-back", text: "‹" });
      back.setAttr("aria-label", "Back");
      back.onclick = () => this.back();
    }
    head.createDiv({ cls: "sg-lp-title", text: this.title() });

    const body = c.createDiv({ cls: "sg-lp-body" });
    if (v.kind === "home") this.renderHome(body);
    else if (v.kind === "scriptures") this.renderScriptures(body);
    else if (v.kind === "books") this.renderBooks(body, v.volume);
    else if (v.kind === "chapters") this.renderChapters(body, v.book);
    else this.renderFolder(body, v.path);
  }

  // ------------------------------------------------------------ cover cards

  private coverSeq = 0;

  private cover(grid: HTMLElement, opts: {
    icon?: NavIconName; hue?: string; label: string;
    lines?: string[]; jacket?: string; onTap: () => void;
  }): void {
    const card = grid.createDiv({ cls: "sg-nav-cover" });
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
    const last = this.host.lastChapter();
    if (last) {
      const cont = c.createDiv({ cls: "sg-nav-continue" });
      navIcon(cont, "continue").addClass("sg-nav-continue-ico");
      const col = cont.createDiv({ cls: "sg-nav-continue-col" });
      col.createSpan({ cls: "sg-nav-continue-tag", text: "Continue reading" });
      col.createSpan({ cls: "sg-nav-continue-title", text: last.title });
      cont.createSpan({ cls: "sg-nav-chev", text: "›" });
      cont.onclick = () => this.host.openChapter(last.title);
    }
    const rec = this.host.recentChapters()
      .filter(r => r.slug !== last?.slug).slice(0, 4);
    if (rec.length) {
      const row = c.createDiv({ cls: "sg-nav-recent" });
      for (const r of rec) {
        const pill = row.createEl("button", { cls: "sg-nav-recent-pill", text: r.title });
        pill.onclick = () => this.host.openChapter(r.title);
      }
    }
    // the shelf, GL's top level: Scriptures is ONE cover — the black jacket
    // with the four works stamped in gold down its front, like the photo
    const grid = c.createDiv({ cls: "sg-nav-covers" });
    this.cover(grid, {
      label: "Scriptures", hue: "#d9c07a", jacket: "sg-cover-jacket",
      lines: ["Holy Bible", "Book of Mormon", "Doctrine and Covenants", "Pearl of Great Price"],
      onTap: () => this.go({ kind: "scriptures" }),
    });
    this.cover(grid, { icon: "timeline", label: "Timeline",
      onTap: () => this.host.openTimeline() });
    this.cover(grid, { icon: "hub", label: "Study Hub",
      onTap: () => this.host.openNote("Study Hub") });
    for (const s of LIBRARY_SECTIONS) {
      const l = this.host.listFolder(s.path);
      if (!l.folders.length && !l.files.length) continue;
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

  private renderFolder(c: HTMLElement, path: string): void {
    const listing = this.host.listFolder(path);
    const yearish = listing.folders.length > 3
      && listing.folders.every(f => /^\d{4}$/.test(f.name));
    const folders = yearish ? [...listing.folders].reverse() : listing.folders;
    let filter = "";
    const list = c.createDiv({ cls: "sg-nav-list" });
    const renderRows = () => {
      list.empty();
      const q = filter.toLowerCase();
      let i = 0;
      for (const f of folders) {
        if (q && !f.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row" });
        cascade(row, i++);
        navIcon(row, "folder");
        row.createSpan({ cls: "sg-nav-name", text: f.name });
        row.createSpan({ cls: "sg-nav-chev", text: "›" });
        row.onclick = () => this.go({ kind: "folder", path: f.path, title: f.name });
      }
      for (const fi of listing.files) {
        if (q && !fi.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, i++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: fi.name });
        row.onclick = () => this.host.openPath(fi.path);
      }
      if (!list.childElementCount) {
        list.createDiv({ cls: "sg-nav-empty", text: "Nothing here matches." });
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
    }).catch(fail);
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
