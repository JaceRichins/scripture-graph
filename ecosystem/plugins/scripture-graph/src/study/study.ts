/** Study module (§20-23): bookmarks, study trails, flashcards-lite — all
 * personal data in the annotation system / device store, never shared vault. */
import { Modal, Notice, Setting, TFile } from "obsidian";
import { chapterIdFromTitle, nowIso, parseVerseId, uuid, verseDisplay, type Annotation } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, PERSONAL_PREFIX, SGState } from "../state";
import type { AnnotationService } from "../social/annotations";

interface TrailStep { title: string; at: string }
interface CardState { ease: number; intervalDays: number; due: string; reps: number }

export class StudyService {
  private trail: TrailStep[] = [];

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
    if (!f) return;
    let anchor: string | null = null;
    if (f.path.startsWith(CANONICAL_PREFIX)) anchor = chapterIdFromTitle(f.basename);
    if (!anchor) {
      // engine pages carry a rename-stable sg-id ("topic:faith"); fall back to title
      const fm = this.s.app.metadataCache.getFileCache(f)?.frontmatter as
        Record<string, unknown> | undefined;
      const sgId = typeof fm?.["sg-id"] === "string" ? (fm["sg-id"] as string) : null;
      anchor = sgId ?? `node:${f.basename}`;
    }
    await this.ann.addNote(anchor, `Bookmark: [[${f.basename}]]`, null,
      this.s.settings.defaultVisibility === "local" ? "local" : "private", null);
    // repurpose type
    const all = await this.s.sync.allAnnotations();
    const latest = all.filter(a => a.anchor_id === anchor).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (latest) await this.s.sync.save({ ...latest, annotation_type: "bookmark" });
    this.s.rerenderReading();
    new Notice(`Bookmarked ${f.basename}`);
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
