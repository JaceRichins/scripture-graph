/** 📖 The Navigator — Gospel-Library-style volume → book → chapter jumping.
 *
 * Three taps from anywhere to any chapter; opening it while reading resumes
 * at the current book so adjacent chapters are one tap away. Every
 * destination is the personal My Study page — never the AI Library — so a
 * family member can wander freely and do no damage. */
import { App, Modal } from "obsidian";
import { BOOKS, chapterTitle, type BookInfo } from "@scripture-graph/core-sdk";
import { cascade, navIcon, type NavIconName } from "./navIcons";
import { buildSearchIndex, searchIndexReady, smartSearch, type SearchResults } from "./search";

export interface GroupActivityRow {
  group_name: string;
  chapter_slug: string;
  count: number;
  others: number;
}

export interface FolderListing {
  folders: { name: string; path: string }[];
  files: { name: string; path: string }[];
}

export interface NavigatorHost {
  openChapter(title: string): void;
  openNote(linkText: string): void;
  lastChapter(): { slug: string; title: string } | null;
  recentChapters(): { slug: string; title: string }[];
  groupActivity(): Promise<GroupActivityRow[]>;
  listFolder(path: string): FolderListing;
  openPath(path: string): void;
  openTimeline(): void;
}

/** the rest of the library — everything beyond the scriptures themselves */
const LIBRARY_SECTIONS: { icon: NavIconName; name: string; path: string }[] = [
  { icon: "conference", name: "General Conference", path: "AI Library/10 General Conference" },
  { icon: "dictionary", name: "Bible Dictionary", path: "AI Library/80 Bible Dictionary" },
  { icon: "topics", name: "Gospel Topics", path: "AI Library/02 Gospel Topics" },
  { icon: "person", name: "People", path: "AI Library/03 People" },
  { icon: "place", name: "Places", path: "AI Library/04 Places" },
  { icon: "event", name: "Events", path: "AI Library/05 Events" },
  { icon: "doctrines", name: "Doctrines", path: "AI Library/06 Doctrines" },
  { icon: "papers", name: "Joseph Smith Papers", path: "AI Library/20 Joseph Smith Papers" },
  { icon: "history", name: "Church History", path: "AI Library/30 Church History" },
  { icon: "evidence", name: "Evidence", path: "AI Library/40 Evidence" },
  { icon: "question", name: "Questions", path: "AI Library/50 Questions" },
  { icon: "scholarship", name: "Scholarship", path: "AI Library/60 Scholarship" },
  { icon: "podcast", name: "Podcasts & talks", path: "AI Library/65 Secondary Sources" },
];

/** "alma-36" → "Alma 36" (null for anything that isn't a chapter slug) */
function titleForChapterSlug(slug: string): string | null {
  const m = /^(.+)-(\d+)$/.exec(slug);
  if (!m) return null;
  return chapterTitle(m[1]!, Number(m[2]));
}

const VOLUMES: { name: string; icon: NavIconName }[] = [
  { name: "Old Testament", icon: "old-testament" },
  { name: "New Testament", icon: "new-testament" },
  { name: "Book of Mormon", icon: "book-of-mormon" },
  { name: "Doctrine and Covenants", icon: "doctrine" },
  { name: "Pearl of Great Price", icon: "pearl" },
];

type NavView =
  | { kind: "home" }
  | { kind: "books"; volume: string }
  | { kind: "chapters"; book: BookInfo }
  | { kind: "library" }
  | { kind: "folder"; path: string; title: string };

export class SGNavigatorModal extends Modal {
  private view: NavView = { kind: "home" };
  private trail: NavView[] = [];
  private searchQuery = "";
  private searchTimer: number | null = null;
  private searchSeq = 0;
  private groupActs: GroupActivityRow[] | null = null;

  constructor(app: App, private host: NavigatorHost) {
    super(app);
    // resume where the reader is: straight to the current book's chapters
    const last = host.lastChapter();
    if (last) {
      const book = BOOKS.find(b => last.slug.startsWith(`${b.slug}-`));
      if (book) this.view = { kind: "chapters", book };
    }
  }

  onOpen(): void { this.render(); }

  /** leave the way we arrived: a quick fade-down instead of a hard pop */
  private closing = false;
  close(): void {
    if (this.closing
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      super.close();
      return;
    }
    this.closing = true;
    this.modalEl.addClass("sg-nav-out");
    this.modalEl.parentElement?.addClass("sg-nav-bg-out");
    window.setTimeout(() => super.close(), 150);
  }

  onClose(): void {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.contentEl.empty();
  }

  /** drill somewhere, remembering where we came from */
  private go(v: NavView): void {
    this.trail.push(this.view);
    this.view = v;
    this.render();
  }

  private back(): void {
    const prev = this.trail.pop();
    if (prev) { this.view = prev; this.render(); return; }
    // no trail (opened resumed at chapters): fall back to the natural parent
    const v = this.view;
    this.view = v.kind === "chapters" ? { kind: "books", volume: v.book.volume }
      : v.kind === "folder" ? { kind: "library" }
        : { kind: "home" };
    this.render();
  }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    c.addClass("sg-nav");
    this.modalEl.addClass("sg-nav-modal");

    const v = this.view;
    const head = c.createDiv({ cls: "sg-nav-head" });
    if (v.kind !== "home") {
      const back = head.createEl("button", { cls: "sg-nav-btn sg-nav-back", text: "‹" });
      back.setAttr("aria-label", "Back");
      back.onclick = () => this.back();
    }
    head.createSpan({
      cls: "sg-nav-title",
      text: v.kind === "home" ? "Scriptures"
        : v.kind === "books" ? v.volume
          : v.kind === "chapters" ? v.book.name
            : v.kind === "library" ? "Library"
              : v.title,
    });
    if (v.kind !== "home") {
      const home = head.createEl("button", { cls: "sg-nav-btn sg-nav-homebtn", text: "⌂" });
      home.setAttr("aria-label", "Home");
      home.onclick = () => { this.trail = []; this.view = { kind: "home" }; this.render(); };
    }

    if (v.kind === "home") this.renderHome(c);
    else if (v.kind === "books") this.renderBooks(c, v.volume);
    else if (v.kind === "chapters") this.renderChapters(c, v.book);
    else if (v.kind === "library") this.renderLibrary(c);
    else this.renderFolder(c, v.path);
  }

  /** Home = a search box over the browsing rows. Under 2 chars the rows
   * show; at 2+ the smart search takes the body over, and clearing the box
   * hands it back. */
  private renderHome(c: HTMLElement): void {
    const wrap = c.createDiv({ cls: "sg-nav-searchwrap" });
    navIcon(wrap, "search").addClass("sg-nav-searchico");
    const inp = wrap.createEl("input", {
      cls: "sg-nav-filter sg-nav-search",
      attr: { type: "search", placeholder: "Search scriptures, people, places…", enterkeyhint: "search" },
    });
    inp.value = this.searchQuery;
    const body = c.createDiv({ cls: "sg-nav-searchhost" });
    const showHome = () => {
      this.searchSeq++;           // orphan any in-flight search render
      body.removeClass("sg-nav-scroll");
      body.empty();
      this.renderHomeRows(body);
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
    else this.renderHomeRows(body);
  }

  /** First search of the session builds the index; a quiet progress row
   * keeps the wait honest, then results replace it. A failed build says so
   * instead of stranding the progress row forever. */
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
    body.addClass("sg-nav-scroll");
    // invoke the destination first, then close — the peek/sheet stacks freely
    const open = (go: () => void) => { go(); this.close(); };
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
      row.onclick = () => open(() => {
        if (ref.anchor) this.host.openNote(`${ref.title}#^${ref.anchor}`);
        else this.host.openChapter(ref.title);
      });
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
      row.onclick = () => open(() => this.host.openNote(`${v.chapter}#^${v.anchor}`));
    }
    if (res.pages.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Library" });
      for (const p of res.pages) {
        const row = body.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, ri++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: p.title });
        row.onclick = () => open(() => this.host.openPath(p.path));
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
        row.onclick = () => open(() => this.host.openChapter(ch.title));
      }
    }
  }

  private renderHomeRows(c: HTMLElement): void {
    const last = this.host.lastChapter();
    if (last) {
      const cont = c.createDiv({ cls: "sg-nav-continue" });
      navIcon(cont, "continue").addClass("sg-nav-continue-ico");
      const col = cont.createDiv({ cls: "sg-nav-continue-col" });
      col.createSpan({ cls: "sg-nav-continue-tag", text: "Continue reading" });
      col.createSpan({ cls: "sg-nav-continue-title", text: last.title });
      cont.createSpan({ cls: "sg-nav-chev", text: "›" });
      cont.onclick = () => { this.close(); this.host.openChapter(last.title); };
    }
    // parallel studies: everything you've been reading lately, one tap each
    const rec = this.host.recentChapters()
      .filter(r => r.slug !== last?.slug).slice(0, 4);
    if (rec.length) {
      const row = c.createDiv({ cls: "sg-nav-recent" });
      for (const r of rec) {
        const pill = row.createEl("button", { cls: "sg-nav-recent-pill", text: r.title });
        pill.onclick = () => { this.close(); this.host.openChapter(r.title); };
      }
    }
    const list = c.createDiv({ cls: "sg-nav-list" });
    let i = 0;
    for (const vol of VOLUMES) {
      const row = list.createDiv({ cls: "sg-nav-row" });
      cascade(row, i++);
      navIcon(row, vol.icon);
      row.createSpan({ cls: "sg-nav-name", text: vol.name });
      row.createSpan({ cls: "sg-nav-chev", text: "›" });
      row.onclick = () => {
        const books = BOOKS.filter(b => b.volume === vol.name);
        this.go(books.length === 1
          ? { kind: "chapters", book: books[0]! }
          : { kind: "books", volume: vol.name });
      };
    }
    const tl = list.createDiv({ cls: "sg-nav-row sg-nav-tl" });
    cascade(tl, i++);
    navIcon(tl, "timeline");
    tl.createSpan({ cls: "sg-nav-name", text: "Timeline" });
    tl.createSpan({ cls: "sg-nav-chev", text: "›" });
    tl.onclick = () => { this.close(); this.host.openTimeline(); };
    // everything beyond the scriptures: conference talks, the dictionary,
    // topics, people, evidence... one door, endless shelves
    const lib = list.createDiv({ cls: "sg-nav-row sg-nav-lib" });
    cascade(lib, i++);
    navIcon(lib, "library");
    lib.createSpan({ cls: "sg-nav-name", text: "Library" });
    lib.createSpan({ cls: "sg-nav-chev", text: "›" });
    lib.onclick = () => this.go({ kind: "library" });
    const hub = list.createDiv({ cls: "sg-nav-row sg-nav-hub" });
    cascade(hub, i++);
    navIcon(hub, "hub");
    hub.createSpan({ cls: "sg-nav-name", text: "Study Hub" });
    hub.onclick = () => { this.close(); this.host.openNote("Study Hub"); };
    // what your groups have been studying — fills in when the server answers
    // (once per modal; search round-trips reuse it); offline it says nothing
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
        row.onclick = () => { this.close(); this.host.openChapter(title); };
      }
    }).catch(() => { /* unreachable server — the section just doesn't appear */ });
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

  private renderLibrary(c: HTMLElement): void {
    const list = c.createDiv({ cls: "sg-nav-list sg-nav-scroll" });
    let i = 0;
    for (const s of LIBRARY_SECTIONS) {
      const l = this.host.listFolder(s.path);
      if (!l.folders.length && !l.files.length) continue;  // empty shelves stay hidden
      const row = list.createDiv({ cls: "sg-nav-row" });
      cascade(row, i++);
      navIcon(row, s.icon);
      row.createSpan({ cls: "sg-nav-name", text: s.name });
      row.createSpan({ cls: "sg-nav-chev", text: "›" });
      row.onclick = () => this.go({ kind: "folder", path: s.path, title: s.name });
    }
  }

  private renderFolder(c: HTMLElement, path: string): void {
    const listing = this.host.listFolder(path);
    // conference years read best newest-first
    const yearish = listing.folders.length > 3
      && listing.folders.every(f => /^\d{4}$/.test(f.name));
    const folders = yearish ? [...listing.folders].reverse() : listing.folders;
    let filter = "";
    const list = c.createDiv({ cls: "sg-nav-list sg-nav-scroll" });
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
        row.onclick = () => { this.close(); this.host.openPath(fi.path); };
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

  private renderChapters(c: HTMLElement, book: BookInfo): void {
    const cur = this.host.lastChapter();
    const grid = c.createDiv({ cls: "sg-nav-chapters" });
    for (let n = 1; n <= book.chapters; n++) {
      const btn = grid.createEl("button", { cls: "sg-nav-ch", text: String(n) });
      cascade(btn, Math.floor((n - 1) / 6));    // fade in row by row, not cell by cell
      if (cur?.slug === `${book.slug}-${n}`) btn.addClass("sg-nav-ch-now");
      btn.onclick = () => { this.close(); this.host.openChapter(`${book.prefix} ${n}`); };
    }
  }
}
