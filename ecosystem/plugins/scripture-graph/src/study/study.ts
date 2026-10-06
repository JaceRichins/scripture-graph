/** Study module (§20-23): bookmarks, study trails, flashcards-lite — all
 * personal data in the annotation system / device store, never shared vault. */
import { Modal, Notice, Setting, TFile } from "obsidian";
import { bookmarkContent, chapterIdFromTitle, nowIso, parseBookmark, parseVerseId, uuid, verseDisplay, type Annotation, type BookmarkPlace } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, PERSONAL_PREFIX, SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import { documentTitle } from "../ai/documentContext";

export interface BookmarkEntry { mark: Annotation; title: string; path: string | null; place: BookmarkPlace | null; at: string }

/** A page's lasting id when it has no chapter id or sg-id (anchor ids are capped at 200 characters). */
function docAnchor(path: string): string {
  if (path.length <= 196) return `doc:${path}`;
  let a = 0x811c9dc5, b = 0x01000193;
  for (const ch of path) { const c = ch.codePointAt(0)!; a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
  return `doc:~${a.toString(16)}${b.toString(16)}`;
}

/** A notice with an Undo button: removing something is never silent or final. */
function undoNotice(message: string, undo: () => Promise<void>): void {
  const fragment = document.createDocumentFragment();
  fragment.append(document.createTextNode(`${message} `));
  const button = document.createElement("button");
  button.textContent = "Undo";
  fragment.append(button);
  const notice = new Notice(fragment, 8000);
  button.onclick = event => { event.stopPropagation(); notice.hide(); void undo(); };
}

interface TrailStep { title: string; at: string }
interface CardState { ease: number; intervalDays: number; due: string; reps: number }

export class StudyService {
  private trail: TrailStep[] = [];
  bookmarksChanged: () => Promise<void> = async () => {};

  constructor(private s: SGState, private ann: AnnotationService) {}

  // ------------------------------------------------------------ trails
  recordVisit(file: TFile): void {
    if (!file.path.startsWith("AI Library/")) return;
    const last = this.trail[this.trail.length - 1];
    if (last?.title === file.basename) return;
    this.trail.push({ title: file.basename, at: nowIso() });
    if (this.trail.length > 100) this.trail.shift();
  }

  async saveTrail(): Promise<void> {
    if (this.trail.length < 2) return void new Notice("Trail is empty — study a little first");
    const name = `Trail ${new Date().toISOString().slice(0, 10)}`;
    const dlg = new NameModal(this.s, name, async chosen => {
      const folder = `${PERSONAL_PREFIX}Study Trails`;
      if (!this.s.app.vault.getAbstractFileByPath(folder)) {
        await this.s.app.vault.createFolder(folder);
      }
      const body = this.trail.map(t => `- [[${t.title}]]`).join("\n");
      await this.s.app.vault.create(
        `${folder}/${chosen.replace(/[<>:"/\\|?*#^\[\]]/g, "")}.md`,
        `---\nownership: personal\nmutable: user\ncontent_type: study-trail\n---\n\n# ${chosen}\n\n${body}\n`);
      new Notice("Trail saved to Library/Study Trails");
      this.trail = [];
    });
    dlg.open();
  }

  // --------------------------------------------------------- bookmarks
  async bookmarkCurrent(): Promise<void> {
    const f = this.s.app.workspace.getActiveFile();
    if (!f) return void new Notice("Open a page first, then bookmark it");
    await this.bookmarkFile(f);
  }

  /** One bookmark per page. A chapter is the same page whether it is read in the
   * reader or on its editable My Notes companion; other pages are known by their
   * sg-id or their path, never by a bare file name. */
  bookmarkTarget(f: TFile): { anchor: string; legacy: string[]; title: string; path: string } {
    const legacy = [`node:${f.basename}`];
    const notes = f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes") ? f.basename.slice(0, -" - My Notes".length) : null;
    const chapter = notes ?? (f.path.startsWith(CANONICAL_PREFIX) ? f.basename : null);
    const id = chapter ? chapterIdFromTitle(chapter) : null;
    if (id && chapter) return { anchor: id, legacy, title: chapter, path: f.path };
    const fm = this.s.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined;
    const sgId = typeof fm?.["sg-id"] === "string" ? (fm["sg-id"] as string) : null;
    return { anchor: sgId ?? docAnchor(f.path), legacy, title: documentTitle(this.s.app, f), path: f.path };
  }

  private myBookmarks(all: Annotation[]): Annotation[] {
    return all.filter(a => a.author_user_id === this.s.device.userId && a.annotation_type === "bookmark" && !a.deleted_at);
  }

  positionKey(id: string): string { return `bookmark-position:${this.s.device.userId}:${id}`; }

  /** my live bookmark on this page, if there is one */
  async bookmarkOf(f: TFile): Promise<Annotation | null> {
    const target = this.bookmarkTarget(f);
    const marks = this.myBookmarks(await this.s.sync.allAnnotations());
    return marks.find(a => a.anchor_id === target.anchor)
      ?? marks.find(a => target.legacy.includes(a.anchor_id) && (parseBookmark(a.content).record?.path ?? f.path) === f.path) ?? null;
  }

  /** Create: tapping the empty ribbon. Tapping it again never deletes; it shows the bookmark. */
  async bookmarkFile(f: TFile): Promise<void> {
    if (await this.bookmarkOf(f)) { await this.bookmarksChanged(); return; }
    const target = this.bookmarkTarget(f);
    await this.ann.addBookmark(target.anchor, bookmarkContent({ path: target.path, title: target.title, place: null, at: nowIso() }));
    await this.bookmarksChanged();
    new Notice(`Bookmarked “${target.title}”. Your place is kept as you read.`);
  }

  /** Delete: only from the bookmark sheet or list, and always with Undo. */
  async unbookmark(a: Annotation): Promise<void> {
    const key = this.positionKey(a.annotation_id);
    const local = await this.s.store.get<unknown>(key);
    await this.ann.remove(a.annotation_id);
    await this.s.store.delete(key);
    await this.bookmarksChanged();
    undoNotice(`Bookmark removed from “${parseBookmark(a.content).title ?? "this page"}”.`, async () => {
      const restored = await this.ann.addBookmark(a.anchor_id, a.content);
      if (local) await this.s.store.put(this.positionKey(restored.annotation_id), local);
      await this.bookmarksChanged();
      new Notice("Bookmark restored.");
    });
  }

  /** Read: every bookmark, the most recently read first, with where the reader left off. */
  async bookmarks(): Promise<BookmarkEntry[]> {
    const entries = await Promise.all(this.myBookmarks(await this.s.sync.allAnnotations()).map(mark => this.entry(mark)));
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** This device's latest place, or the synced one from another device, whichever is newer. */
  async entry(mark: Annotation): Promise<BookmarkEntry> {
    const { title, record } = parseBookmark(mark.content);
    const raw = await this.s.store.get<Record<string, unknown>>(this.positionKey(mark.annotation_id));
    const local = raw && typeof raw["top"] === "number" ? { place: raw as unknown as BookmarkPlace, at: typeof raw["savedAt"] === "string" ? raw["savedAt"] : "" } : null;
    const synced = record?.place && record.at ? { place: record.place, at: record.at } : null;
    const best = local && (!synced || local.at > synced.at) ? local : synced;
    return { mark, title: title ?? mark.anchor_id, path: record?.path ?? null, place: best?.place ?? null, at: (best?.at || record?.at) ?? mark.updated_at };
  }

  /** The place last saved into the bookmark (possibly by another device). */
  async syncedPlace(id: string): Promise<{ place: BookmarkPlace; at: string } | null> {
    const mark = await this.s.sync.getAnnotation(id);
    const record = mark && !mark.deleted_at ? parseBookmark(mark.content).record : null;
    return record?.place && record.at ? { place: record.place, at: record.at } : null;
  }

  /** Update: the reader's place is written into the bookmark when they leave the page
   * or the app (not on every scroll), so it follows them to their other devices. */
  async persistPlace(id: string, file: TFile, place: BookmarkPlace): Promise<void> {
    const mark = await this.s.sync.getAnnotation(id);
    if (!mark || mark.deleted_at || mark.annotation_type !== "bookmark") return;
    const { title, record } = parseBookmark(mark.content);
    if (record?.place && JSON.stringify(record.place) === JSON.stringify(place)) return;
    const target = this.bookmarkTarget(file);
    const content = bookmarkContent({ path: record?.path ?? target.path, title: record?.title ?? title ?? target.title, place, at: nowIso() });
    await this.s.sync.save({ ...mark, content, updated_at: nowIso() });
    this.ann.scheduleSync(2_000);
  }

  /** Open a bookmark where it was kept; chapters open the way chapter links do. */
  async openBookmark(entry: BookmarkEntry): Promise<void> {
    const workspace = this.s.app.workspace;
    if (chapterIdFromTitle(entry.title) === entry.mark.anchor_id) { await workspace.openLinkText(entry.title, ""); return; }
    const file = entry.path ? this.s.app.vault.getAbstractFileByPath(entry.path) : null;
    await workspace.openLinkText(file instanceof TFile ? file.path : entry.title, "");
  }

  /** After each sync: finish old repairs, move file-name bookmarks to lasting ids, and keep one bookmark per page. */
  async maintainBookmarks(): Promise<void> {
    await this.repairFailedBookmarks();
    const moved = await this.migrateBookmarks();
    const merged = await this.dedupeBookmarks();
    if (moved || merged) { this.ann.scheduleSync(500); await this.bookmarksChanged(); }
  }

  private async migrateBookmarks(): Promise<boolean> {
    const me = this.s.device.userId;
    if (!me) return false;
    const done = `bookmark-migrate-v2:${me}`;
    if (await this.s.store.get<boolean>(done)) return false;
    let changed = false;
    for (const mark of this.myBookmarks(await this.s.sync.allAnnotations())) {
      if (!mark.anchor_id.startsWith("node:")) continue;
      const files = this.s.app.vault.getMarkdownFiles().filter(f => f.basename === mark.anchor_id.slice(5));
      if (files.length !== 1) continue;  // ambiguous, or not on this device: leave it for a device that knows
      const target = this.bookmarkTarget(files[0]!);
      if (target.anchor === mark.anchor_id) continue;
      if (!this.myBookmarks(await this.s.sync.allAnnotations()).some(a => a.anchor_id === target.anchor)) {
        const record = parseBookmark(mark.content).record;
        const moved = await this.ann.addBookmark(target.anchor, bookmarkContent({ path: target.path, title: target.title, place: record?.place ?? null, at: record?.at ?? mark.updated_at }));
        const local = await this.s.store.get<unknown>(this.positionKey(mark.annotation_id));
        if (local) await this.s.store.put(this.positionKey(moved.annotation_id), local);
      }
      await this.s.sync.softDelete(mark.annotation_id);
      await this.s.store.delete(this.positionKey(mark.annotation_id));
      changed = true;
    }
    await this.s.store.put(done, true);
    return changed;
  }

  /** Two devices, or a migration racing a tap, must never leave two bookmarks on one page. */
  private async dedupeBookmarks(): Promise<boolean> {
    const pages = new Map<string, Annotation[]>();
    for (const mark of this.myBookmarks(await this.s.sync.allAnnotations())) pages.set(mark.anchor_id, [...(pages.get(mark.anchor_id) ?? []), mark]);
    let changed = false;
    for (const marks of pages.values()) {
      if (marks.length < 2) continue;
      const latest = (m: Annotation) => parseBookmark(m.content).record?.at ?? m.updated_at;
      marks.sort((a, b) => latest(b).localeCompare(latest(a)));
      for (const extra of marks.slice(1)) { await this.s.sync.softDelete(extra.annotation_id); await this.s.store.delete(this.positionKey(extra.annotation_id)); }
      changed = true;
    }
    return changed;
  }

  /** Earlier bookmarks were saved as a note and then retyped, and the server kept
   * the note. Once per account, turn the newest such note on each page into the
   * bookmark it was meant to be and remove the duplicates. */
  async repairFailedBookmarks(): Promise<void> {
    const me = this.s.device.userId;
    if (!me) return;
    const done = `bookmark-repair-v1:${me}`;
    if (await this.s.store.get<boolean>(done)) return;
    const mine = (await this.s.sync.allAnnotations()).filter(a => a.author_user_id === me && !a.deleted_at);
    const failed = new Map<string, Annotation[]>();
    for (const a of mine) {
      if (a.annotation_type === "note" && /^Bookmark: \[\[[^\]]+\]\]$/.test(a.content.trim())) failed.set(a.anchor_id, [...(failed.get(a.anchor_id) ?? []), a]);
    }
    for (const [anchor, notes] of failed) {
      notes.sort((x, y) => y.created_at.localeCompare(x.created_at));
      const kept = mine.some(a => a.anchor_id === anchor && a.annotation_type === "bookmark");
      if (!kept) await this.s.sync.save({ ...notes[0]!, annotation_type: "bookmark", updated_at: nowIso() });
      for (const note of kept ? notes : notes.slice(1)) await this.s.sync.softDelete(note.annotation_id);
    }
    await this.s.store.put(done, true);
    if (failed.size) {
      this.ann.scheduleSync(500);
      await this.bookmarksChanged();
      this.s.rerenderReading();
    }
  }

  // -------------------------------------------------------- flashcards
  /** Idempotent: the same card (anchor + answer) is never added twice.
   * Comparison ignores punctuation/symbols so decoration glyphs or trailing
   * marks can never sneak a duplicate past the check. */
  async addFlashcard(front: string, back: string, anchor: string | null): Promise<boolean> {
    const norm = (t: string) => t.normalize("NFKD")
      .replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
    const all = await this.s.sync.allAnnotations();
    const dup = all.find(x => {
      if (x.annotation_type !== "study-marker" || x.deleted_at) return false;
      if (x.anchor_id !== (anchor ?? "node:flashcards")) return false;
      try {
        const d = JSON.parse(x.content) as { back?: string };
        return norm(d.back ?? "") === norm(back);
      } catch { return false; }
    });
    if (dup) {
      new Notice("You already have this flashcard 🃏");
      return false;
    }
    const a = {
      annotation_id: uuid(), author_user_id: this.s.device.userId,
      anchor_type: (anchor && parseVerseId(anchor) ? "verse" : "node") as "verse" | "node",
      anchor_id: anchor ?? "node:flashcards",
      annotation_type: "study-marker" as const,
      selected_text: null, start_offset: null, end_offset: null, text_hash: null,
      content: JSON.stringify({
        front, back,
        card: { ease: 2.5, intervalDays: 0, due: nowIso(), reps: 0 } satisfies CardState,
      }),
      color: null, style: null, theme: null,
      visibility: "private" as const, group_id: null,
      created_at: nowIso(), updated_at: nowIso(), deleted_at: null, version: 1,
    };
    await this.s.sync.save(a);
    this.s.rerenderReading();   // 🃏 marker appears on the verse immediately
    new Notice("Flashcard added 🃏");
    return true;
  }

  async review(): Promise<void> {
    const all = await this.s.sync.allAnnotations();
    const due = all.filter(a => {
      if (a.annotation_type !== "study-marker") return false;
      try {
        const c = (JSON.parse(a.content) as { card: CardState }).card;
        return c.due <= nowIso();
      } catch { return false; }
    });
    if (!due.length) return void new Notice("No cards due — well done!");
    new ReviewModal(this.s, due, async (a, quality) => {
      const data = JSON.parse(a.content) as { front: string; back: string; card: CardState };
      const c = data.card;
      if (quality < 2) { c.intervalDays = 0; c.due = nowIso(); }
      else {
        c.ease = Math.max(1.3, c.ease + (quality === 3 ? 0.1 : -0.15));
        c.intervalDays = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.intervalDays * c.ease);
        c.reps += 1;
        c.due = new Date(Date.now() + c.intervalDays * 86400_000).toISOString();
      }
      await this.s.sync.save({ ...a, content: JSON.stringify(data), updated_at: nowIso() });
    }).open();
  }
}

class NameModal extends Modal {
  constructor(s: SGState, private initial: string, private onSubmit: (name: string) => void) {
    super(s.app);
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Save study trail" });
    let v = this.initial;
    new Setting(this.contentEl).setName("Name").addText(t =>
      t.setValue(this.initial).onChange(x => (v = x)));
    new Setting(this.contentEl).addButton(b => b.setButtonText("Save").setCta()
      .onClick(() => { this.close(); this.onSubmit(v || this.initial); }));
  }
  onClose() { this.contentEl.empty(); }
}

class ReviewModal extends Modal {
  private i = 0;
  constructor(s: SGState,
    private cards: Annotation[],
    private grade: (a: Annotation, quality: number) => Promise<void>) {
    super(s.app);
  }
  onOpen() { this.render(); }
  private render() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.i >= this.cards.length) {
      contentEl.createEl("h3", { text: "Review complete 🎉" });
      return;
    }
    const a = this.cards[this.i]!;
    const data = JSON.parse(a.content) as { front: string; back: string };
    contentEl.createEl("p", { text: `${this.i + 1} / ${this.cards.length}` });
    contentEl.createEl("h3", { text: data.front });
    const ref = verseDisplay(a.anchor_id);
    if (ref) contentEl.createEl("p", { text: ref, cls: "sg-card-ref" });
    const reveal = contentEl.createEl("button", { text: "Show answer" });
    reveal.onclick = () => {
      reveal.remove();
      contentEl.createEl("blockquote", { text: data.back });
      const row = contentEl.createDiv({ cls: "sg-card-grades" });
      for (const [label, q] of [["Again", 0], ["Hard", 2], ["Good", 3]] as const) {
        const b = row.createEl("button", { text: label });
        b.onclick = async () => { await this.grade(a, q); this.i++; this.render(); };
      }
    };
  }
  onClose() { this.contentEl.empty(); }
}
