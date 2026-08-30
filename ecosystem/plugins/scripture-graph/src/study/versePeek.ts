/** 👁 Verse peek — a referenced verse pops up where you are.
 *
 * Tapping a cross-reference used to move the reader to another chapter.
 * Now the verse itself appears in a small card — with a whisper of context
 * around it — and "Open chapter" is the deliberate option to actually go.
 * The card stacks over whatever produced it (the connections sheet, a
 * library sheet), so closing it lands the reader exactly where they were. */
import { App, Modal, TFile } from "obsidian";
import { parseVerseId, verseDisplay } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, SGState } from "../state";
import { registerSheet, unregisterSheet } from "./sheetRegistry";

export interface VersePeekTarget {
  file: TFile;
  chapterTitle: string;
  verseId: string;
}

/** verse-anchored link into a canonical chapter → peek target (else null) */
export function peekTargetFor(app: App, linktext: string, sourcePath: string): VersePeekTarget | null {
  if (!linktext.includes("#^")) return null;
  const [base, anchor] = linktext.split("#^");
  const verseId = (anchor ?? "").trim();
  if (!base?.trim() || !parseVerseId(verseId)) return null;
  const dest = app.metadataCache.getFirstLinkpathDest(base.trim(), sourcePath);
  if (!dest || !dest.path.startsWith(CANONICAL_PREFIX)) return null;
  return { file: dest, chapterTitle: dest.basename, verseId };
}

const VERSE_RE = /^\*\*(\d+)\*\*\s+(.*?)\s*\^([a-z0-9]+(?:-\d+)+)\s*$/;

export class VersePeekModal extends Modal {
  constructor(
    private s: SGState,
    private target: VersePeekTarget,
    private openChapter: () => void,
  ) {
    super(s.app);
  }

  onOpen(): void {
    registerSheet(this);
    this.modalEl.addClass("sg-peek-modal");
    const c = this.contentEl;
    c.addClass("sg-peek");
    c.createEl("h3", {
      cls: "sg-peek-title",
      text: `📖 ${verseDisplay(this.target.verseId) ?? this.target.chapterTitle}`,
    });
    const body = c.createDiv({ cls: "sg-peek-body" });
    body.createDiv({ cls: "sg-peek-loading", text: "…" });
    void this.render(body);
    const open = c.createEl("button", {
      cls: "sg-peek-open",
      text: `Open ${this.target.chapterTitle} ▸`,
    });
    open.onclick = () => { this.close(); this.openChapter(); };
  }

  private async render(body: HTMLElement): Promise<void> {
    let verses: { n: number; text: string; id: string }[] = [];
    try {
      const md = await this.s.app.vault.cachedRead(this.target.file);
      for (const line of md.split("\n")) {
        const m = VERSE_RE.exec(line);
        if (m) verses.push({ n: Number(m[1]), text: m[2]!, id: m[3]! });
      }
    } catch { /* fall through to the empty state */ }
    body.empty();
    const i = verses.findIndex(v => v.id === this.target.verseId);
    if (i < 0) {
      body.createDiv({ cls: "sg-peek-missing", text: "This verse could not be loaded." });
      return;
    }
    // a whisper of context on either side, the verse itself front and center
    const before = verses[i - 1];
    const after = verses[i + 1];
    if (before) {
      body.createDiv({ cls: "sg-peek-ctx", text: `${before.n} ${before.text}` });
    }
    const main = body.createDiv({ cls: "sg-peek-verse" });
    main.createSpan({ cls: "sg-peek-num", text: String(verses[i]!.n) });
    main.createSpan({ text: ` ${verses[i]!.text}` });
    if (after) {
      body.createDiv({ cls: "sg-peek-ctx", text: `${after.n} ${after.text}` });
    }
  }

  onClose(): void {
    unregisterSheet(this);
    this.contentEl.empty();
  }
}
