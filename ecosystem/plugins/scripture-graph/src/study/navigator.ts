/** 📖 The Navigator — Gospel-Library-style volume → book → chapter jumping.
 *
 * Three taps from anywhere to any chapter; opening it while reading resumes
 * at the current book so adjacent chapters are one tap away. Every
 * destination is the personal My Study page — never the AI Library — so a
 * family member can wander freely and do no damage. */
import { App, Modal } from "obsidian";
import { BOOKS, chapterTitle, type BookInfo } from "@scripture-graph/core-sdk";

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
const LIBRARY_SECTIONS: { emoji: string; name: string; path: string }[] = [
  { emoji: "🎤", name: "General Conference", path: "AI Library/10 General Conference" },
  { emoji: "📔", name: "Bible Dictionary", path: "AI Library/80 Bible Dictionary" },
  { emoji: "🏷️", name: "Gospel Topics", path: "AI Library/02 Gospel Topics" },
  { emoji: "🧑", name: "People", path: "AI Library/03 People" },
  { emoji: "🗺️", name: "Places", path: "AI Library/04 Places" },
  { emoji: "📅", name: "Events", path: "AI Library/05 Events" },
  { emoji: "📜", name: "Doctrines", path: "AI Library/06 Doctrines" },
  { emoji: "📄", name: "Joseph Smith Papers", path: "AI Library/20 Joseph Smith Papers" },
  { emoji: "🏛️", name: "Church History", path: "AI Library/30 Church History" },
  { emoji: "🔎", name: "Evidence", path: "AI Library/40 Evidence" },
  { emoji: "❓", name: "Questions", path: "AI Library/50 Questions" },
  { emoji: "🎓", name: "Scholarship", path: "AI Library/60 Scholarship" },
  { emoji: "🎙️", name: "Podcasts & talks", path: "AI Library/65 Secondary Sources" },
];

/** "alma-36" → "Alma 36" (null for anything that isn't a chapter slug) */
function titleForChapterSlug(slug: string): string | null {
  const m = /^(.+)-(\d+)$/.exec(slug);
  if (!m) return null;
  return chapterTitle(m[1]!, Number(m[2]));
}

const VOLUMES: { name: string; emoji: string }[] = [
  { name: "Old Testament", emoji: "📜" },
  { name: "New Testament", emoji: "✝️" },
  { name: "Book of Mormon", emoji: "📘" },
  { name: "Doctrine and Covenants", emoji: "🔑" },
  { name: "Pearl of Great Price", emoji: "💎" },
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
  onClose(): void { this.contentEl.empty(); }

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
      text: v.kind === "home" ? "📖 Scriptures"
        : v.kind === "books" ? v.volume
          : v.kind === "chapters" ? v.book.name
            : v.kind === "library" ? "📚 Library"
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

  private renderHome(c: HTMLElement): void {
    const last = this.host.lastChapter();
    if (last) {
      const cont = c.createDiv({ cls: "sg-nav-continue" });
      cont.createSpan({ cls: "sg-nav-continue-tag", text: "▶ Continue reading" });
      cont.createSpan({ cls: "sg-nav-continue-title", text: last.title });
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
    for (const vol of VOLUMES) {
      const row = list.createDiv({ cls: "sg-nav-row" });
      row.createSpan({ cls: "sg-nav-emoji", text: vol.emoji });
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
    tl.createSpan({ cls: "sg-nav-emoji", text: "🕰" });
    tl.createSpan({ cls: "sg-nav-name", text: "Timeline" });
    tl.createSpan({ cls: "sg-nav-chev", text: "›" });
    tl.onclick = () => { this.close(); this.host.openTimeline(); };
    // everything beyond the scriptures: conference talks, the dictionary,
    // topics, people, evidence... one door, endless shelves
    const lib = list.createDiv({ cls: "sg-nav-row sg-nav-lib" });
    lib.createSpan({ cls: "sg-nav-emoji", text: "📚" });
    lib.createSpan({ cls: "sg-nav-name", text: "Library" });
    lib.createSpan({ cls: "sg-nav-chev", text: "›" });
    lib.onclick = () => this.go({ kind: "library" });
    const hub = list.createDiv({ cls: "sg-nav-row sg-nav-hub" });
    hub.createSpan({ cls: "sg-nav-emoji", text: "🏠" });
    hub.createSpan({ cls: "sg-nav-name", text: "Study Hub" });
    hub.onclick = () => { this.close(); this.host.openNote("Study Hub"); };
    // what your groups have been studying — fills in when the server answers;
    // offline or solo it simply says nothing
    const groupsBox = c.createDiv({ cls: "sg-nav-groups" });
    void this.host.groupActivity().then(acts => {
      if (!acts.length || this.view.kind !== "home") return;
      groupsBox.createDiv({ cls: "sg-nav-sect", text: "👥 Studying with your groups" });
      for (const a of acts.slice(0, 4)) {
        const title = titleForChapterSlug(a.chapter_slug);
        if (!title) continue;
        const row = groupsBox.createDiv({ cls: "sg-nav-row sg-nav-group" });
        row.createSpan({ cls: "sg-nav-emoji", text: "👥" });
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
    for (const b of BOOKS.filter(x => x.volume === volume)) {
      const pill = grid.createEl("button", { cls: "sg-nav-book", text: b.name });
      pill.onclick = () => this.go({ kind: "chapters", book: b });
    }
  }

  private renderLibrary(c: HTMLElement): void {
    const list = c.createDiv({ cls: "sg-nav-list sg-nav-scroll" });
    for (const s of LIBRARY_SECTIONS) {
      const l = this.host.listFolder(s.path);
      if (!l.folders.length && !l.files.length) continue;  // empty shelves stay hidden
      const row = list.createDiv({ cls: "sg-nav-row" });
      row.createSpan({ cls: "sg-nav-emoji", text: s.emoji });
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
      for (const f of folders) {
        if (q && !f.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row" });
        row.createSpan({ cls: "sg-nav-emoji", text: "📁" });
        row.createSpan({ cls: "sg-nav-name", text: f.name });
        row.createSpan({ cls: "sg-nav-chev", text: "›" });
        row.onclick = () => this.go({ kind: "folder", path: f.path, title: f.name });
      }
      for (const fi of listing.files) {
        if (q && !fi.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row sg-nav-file" });
        row.createSpan({ cls: "sg-nav-emoji", text: "📄" });
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
      if (cur?.slug === `${book.slug}-${n}`) btn.addClass("sg-nav-ch-now");
      btn.onclick = () => { this.close(); this.host.openChapter(`${book.prefix} ${n}`); };
    }
  }
}
