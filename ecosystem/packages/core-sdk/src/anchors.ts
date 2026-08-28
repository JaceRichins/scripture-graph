/** Stable anchoring (§4, §9, §39).
 *
 * Verse anchors reuse the vault's permanent block IDs: "alma-36-18".
 * Partial-verse highlights add offsets + selected text + a hash of the verse
 * text at anchor time; because canonical text is immutable, drift means data
 * corruption, and the hash makes it detectable.
 */
import booksJson from "./books.json";

export interface BookInfo {
  name: string;
  slug: string;
  prefix: string;
  volume: string;
  chapters: number;
  aliases: string[];
  volumeSeq: number;
  bookSeq: number;
}

export const BOOKS: BookInfo[] = booksJson as BookInfo[];
export const BOOK_BY_SLUG: Map<string, BookInfo> = new Map(BOOKS.map(b => [b.slug, b]));

const ALIAS_MAP: Map<string, BookInfo> = (() => {
  const m = new Map<string, BookInfo>();
  for (const b of BOOKS) {
    const forms = new Set<string>([b.name, b.prefix, ...b.aliases]);
    for (const raw of forms) {
      const f = raw.replace(/[—–]/g, "-");
      m.set(f, b);
      if (f.endsWith(".")) m.set(f.slice(0, -1), b);
    }
  }
  return m;
})();

export interface VerseRef { bookSlug: string; chapter: number; verse: number }

export function parseVerseId(id: string): VerseRef | null {
  const i = id.lastIndexOf("-");
  const j = id.lastIndexOf("-", i - 1);
  if (i < 0 || j < 0) return null;
  const bookSlug = id.slice(0, j);
  const chapter = Number(id.slice(j + 1, i));
  const verse = Number(id.slice(i + 1));
  if (!BOOK_BY_SLUG.has(bookSlug) || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  if (chapter < 1 || verse < 1) return null;
  return { bookSlug, chapter, verse };
}

export function parseChapterId(id: string): { bookSlug: string; chapter: number } | null {
  const j = id.lastIndexOf("-");
  if (j < 0) return null;
  const bookSlug = id.slice(0, j);
  const chapter = Number(id.slice(j + 1));
  if (!BOOK_BY_SLUG.has(bookSlug) || !Number.isInteger(chapter) || chapter < 1) return null;
  return { bookSlug, chapter };
}

export function chapterTitle(bookSlug: string, chapter: number): string | null {
  const b = BOOK_BY_SLUG.get(bookSlug);
  return b ? `${b.prefix} ${chapter}` : null;
}

export function verseDisplay(verseId: string): string | null {
  const r = parseVerseId(verseId);
  if (!r) return null;
  return `${chapterTitle(r.bookSlug, r.chapter)}:${r.verse}`;
}

/** "Alma 36" / "D&C 76" / "Psalm 23" -> chapter id "alma-36" */
export function chapterIdFromTitle(title: string): string | null {
  const m = /^(.+?)\s+(\d{1,3})$/.exec(title.trim());
  if (!m) return null;
  const b = ALIAS_MAP.get(m[1]!.replace(/[—–]/g, "-"));
  return b ? `${b.slug}-${Number(m[2])}` : null;
}

/** Scripture references in prose: "Alma 36:18-20", "1 Ne. 3:7", "D&C 76". */
const ALIAS_ALT = [...ALIAS_MAP.keys()]
  .sort((a, b) => b.length - a.length)
  .map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const REF_RE = new RegExp(
  `(?<![A-Za-z])(${ALIAS_ALT})[ \\u00a0]+(\\d{1,3})(?!\\d)` +
  `((?:\\s*:\\s*\\d{1,3}(?:\\s*-\\s*\\d{1,3})?)?)`, "g");

export interface FoundRef { bookSlug: string; chapter: number; verses: number[]; text: string; index: number }

export function findScriptureRefs(text: string): FoundRef[] {
  const norm = text.replace(/[—–‑]/g, "-");
  const out: FoundRef[] = [];
  for (const m of norm.matchAll(REF_RE)) {
    const book = ALIAS_MAP.get(m[1]!);
    if (!book) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    const verses: number[] = [];
    const vs = (m[3] ?? "").replace(/\s+/g, "");
    const vm = /^:(\d{1,3})(?:-(\d{1,3}))?$/.exec(vs);
    if (vm) {
      const a = Number(vm[1]);
      const b = vm[2] ? Number(vm[2]) : a;
      for (let v = a; v <= Math.min(b, a + 200); v++) verses.push(v);
    }
    out.push({ bookSlug: book.slug, chapter, verses, text: text.slice(m.index!, m.index! + m[0]!.length), index: m.index! });
  }
  return out;
}

// ------------------------------------------------------ partial-text anchor

/** Small stable hash (FNV-1a, 32-bit hex) for drift detection on immutable text. */
export function textHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export interface PartialAnchor {
  selected_text: string;
  start_offset: number;
  end_offset: number;
  text_hash: string; // hash of the FULL verse text at anchor time
}

/** Create a partial anchor from a selection within the verse's plain text. */
export function makePartialAnchor(verseText: string, selected: string): PartialAnchor | null {
  const sel = selected.trim();
  if (sel.length < 1) return null;
  const idx = verseText.indexOf(sel);
  if (idx < 0) return null;
  return {
    selected_text: sel,
    start_offset: idx,
    end_offset: idx + sel.length,
    text_hash: textHash(verseText),
  };
}

/** Resolve a stored partial anchor against current verse text.
 * Offsets are authoritative when the hash matches (immutable canon);
 * otherwise falls back to searching the selected text. */
export function resolvePartialAnchor(
  verseText: string,
  a: { selected_text: string | null; start_offset: number | null; end_offset: number | null; text_hash: string | null },
): { start: number; end: number } | null {
  if (!a.selected_text) return null;
  if (a.text_hash && a.text_hash === textHash(verseText)
      && a.start_offset != null && a.end_offset != null
      && verseText.slice(a.start_offset, a.end_offset) === a.selected_text) {
    return { start: a.start_offset, end: a.end_offset };
  }
  const idx = verseText.indexOf(a.selected_text);
  return idx >= 0 ? { start: idx, end: idx + a.selected_text.length } : null;
}
