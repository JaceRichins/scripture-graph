/** 🌐 Parallel translations — tap a verse, read it four ways.
 *
 * KJV is the canonical reading text; WEB, ASV, and YLT are public-domain
 * translations the engine stores as per-book pages in the AI Library, so
 * lookups are local file reads: offline, instant, and lawful to sync to
 * every family device. Verses are matched by chapter:verse lines. */
import { App, Modal, TFile } from "obsidian";
import { BOOK_BY_SLUG, parseVerseId, verseDisplay } from "@scripture-graph/core-sdk";
import { SGState } from "../state";

export const TRANSLATIONS: { abbr: string; name: string; note: string }[] = [
  { abbr: "KJV", name: "King James Version", note: "your reading text" },
  { abbr: "WEB", name: "World English Bible", note: "modern English · public domain" },
  { abbr: "ASV", name: "American Standard Version", note: "1901 · public domain" },
  { abbr: "YLT", name: "Young's Literal Translation", note: "literal · public domain" },
];

/** other translations exist only for the Bible itself */
export function isBiblical(verseId: string): boolean {
  const r = parseVerseId(verseId);
  const b = r ? BOOK_BY_SLUG.get(r.bookSlug) : undefined;
  return !!b && (b.volume === "Old Testament" || b.volume === "New Testament");
}

const fileCache = new Map<string, string>();

async function bookText(app: App, bookName: string, abbr: string): Promise<string | null> {
  const dest = app.metadataCache.getFirstLinkpathDest(`${bookName} (${abbr})`, "");
  if (!(dest instanceof TFile)) return null;
  const hit = fileCache.get(dest.path);
  if (hit != null) return hit;
  const text = await app.vault.cachedRead(dest);
  if (fileCache.size >= 8) fileCache.clear();  // tiny cap — books are big strings
  fileCache.set(dest.path, text);
  return text;
}

export async function translationVerse(app: App, verseId: string, abbr: string): Promise<string | null> {
  const r = parseVerseId(verseId);
  if (!r) return null;
  const b = BOOK_BY_SLUG.get(r.bookSlug);
  if (!b) return null;
  const text = await bookText(app, b.name, abbr);
  if (!text) return null;
  const m = new RegExp(`^\\*\\*${r.chapter}:${r.verse}\\*\\*\\s+(.*)$`, "m").exec(text);
  return m?.[1]?.trim() || null;
}

export class TranslationsModal extends Modal {
  constructor(private s: SGState, private verseId: string, private kjvText: string) {
    super(s.app);
  }

  onOpen(): void {
    this.modalEl.addClass("sg-trans-modal");
    const c = this.contentEl;
    c.addClass("sg-trans");
    c.createEl("h3", {
      cls: "sg-trans-title",
      text: `🌐 ${verseDisplay(this.verseId) ?? this.verseId}`,
    });
    const list = c.createDiv({ cls: "sg-trans-list" });
    for (const t of TRANSLATIONS) {
      const row = list.createDiv({ cls: "sg-trans-row" });
      if (t.abbr === "KJV") row.addClass("sg-trans-kjv");
      const head = row.createDiv({ cls: "sg-trans-head" });
      head.createSpan({ cls: "sg-trans-abbr", text: t.abbr });
      head.createSpan({ cls: "sg-trans-name", text: `${t.name} · ${t.note}` });
      const body = row.createDiv({
        cls: "sg-trans-text",
        text: t.abbr === "KJV" ? this.kjvText : "…",
      });
      if (t.abbr !== "KJV") {
        void translationVerse(this.s.app, this.verseId, t.abbr).then(v => {
          if (v) { body.setText(v); return; }
          body.setText("not available — this translation may still be syncing to this device");
          body.addClass("sg-trans-missing");
        });
      }
    }
    c.createDiv({
      cls: "sg-trans-foot",
      text: "WEB, ASV, and YLT are public domain and stored in your own library — they work offline.",
    });
  }

  onClose(): void { this.contentEl.empty(); }
}
