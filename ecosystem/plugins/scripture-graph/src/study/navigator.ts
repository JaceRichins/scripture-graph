/** 📖 The Navigator — Gospel-Library-style volume → book → chapter jumping.
 *
 * Three taps from anywhere to any chapter; opening it while reading resumes
 * at the current book so adjacent chapters are one tap away. Every
 * destination is the personal My Study page — never the AI Library — so a
 * family member can wander freely and do no damage. */
import { App, Modal } from "obsidian";
import { BOOKS, type BookInfo } from "@scripture-graph/core-sdk";

export interface NavigatorHost {
  openChapter(title: string): void;
  openNote(linkText: string): void;
  lastChapter(): { slug: string; title: string } | null;
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
  | { kind: "chapters"; book: BookInfo };

export class SGNavigatorModal extends Modal {
  private view: NavView = { kind: "home" };

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
      back.onclick = () => {
        this.view = v.kind === "chapters"
          ? { kind: "books", volume: v.book.volume }
          : { kind: "home" };
        this.render();
      };
    }
    head.createSpan({
      cls: "sg-nav-title",
      text: v.kind === "home" ? "📖 Scriptures"
        : v.kind === "books" ? v.volume
          : v.book.name,
    });
    if (v.kind !== "home") {
      const home = head.createEl("button", { cls: "sg-nav-btn sg-nav-homebtn", text: "⌂" });
      home.setAttr("aria-label", "All volumes");
      home.onclick = () => { this.view = { kind: "home" }; this.render(); };
    }

    if (v.kind === "home") this.renderHome(c);
    else if (v.kind === "books") this.renderBooks(c, v.volume);
    else this.renderChapters(c, v.book);
  }

  private renderHome(c: HTMLElement): void {
    const last = this.host.lastChapter();
    if (last) {
      const cont = c.createDiv({ cls: "sg-nav-continue" });
      cont.createSpan({ cls: "sg-nav-continue-tag", text: "▶ Continue reading" });
      cont.createSpan({ cls: "sg-nav-continue-title", text: last.title });
      cont.onclick = () => { this.close(); this.host.openChapter(last.title); };
    }
    const list = c.createDiv({ cls: "sg-nav-list" });
    for (const vol of VOLUMES) {
      const row = list.createDiv({ cls: "sg-nav-row" });
      row.createSpan({ cls: "sg-nav-emoji", text: vol.emoji });
      row.createSpan({ cls: "sg-nav-name", text: vol.name });
      row.createSpan({ cls: "sg-nav-chev", text: "›" });
      row.onclick = () => {
        const books = BOOKS.filter(b => b.volume === vol.name);
        this.view = books.length === 1
          ? { kind: "chapters", book: books[0]! }
          : { kind: "books", volume: vol.name };
        this.render();
      };
    }
    const hub = list.createDiv({ cls: "sg-nav-row sg-nav-hub" });
    hub.createSpan({ cls: "sg-nav-emoji", text: "🏠" });
    hub.createSpan({ cls: "sg-nav-name", text: "Study Hub" });
    hub.onclick = () => { this.close(); this.host.openNote("Study Hub"); };
  }

  private renderBooks(c: HTMLElement, volume: string): void {
    const grid = c.createDiv({ cls: "sg-nav-books" });
    for (const b of BOOKS.filter(x => x.volume === volume)) {
      const pill = grid.createEl("button", { cls: "sg-nav-book", text: b.name });
      pill.onclick = () => { this.view = { kind: "chapters", book: b }; this.render(); };
    }
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
