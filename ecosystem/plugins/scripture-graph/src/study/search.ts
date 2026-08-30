/** 🔎 Smart search — the navigator learns to listen.
 *
 * Not a %like%: references parse ("1 ne 3:7" jumps straight there), exact
 * phrases always beat scattered words, and scattered words rank by how
 * tightly they huddle. A light KJV stemmer lets "believes" find "believeth".
 * The whole canon indexes once per session; pure scoring lives obsidian-free
 * so node can test it.
 */
import type { App } from "obsidian";
import { BOOKS } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, LIBRARY_PREFIX } from "../state";

// ------------------------------------------------------------ normalization

/** lowercase, fold diacritics, drop punctuation (possessives collapse:
 * "Lord's" → "lords"), collapse whitespace */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/\p{M}+/gu, "")
    .replace(/['’ʼ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** KJV-aware light stemmer: first matching suffix comes off, but a word
 * never shrinks below 3 chars ("believeth" → "believ", "best" stays) */
const SUFFIXES = ["eth", "est", "ings", "ing", "ed", "es", "s", "'s"];
export function stem(t: string): string {
  for (const suf of SUFFIXES) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) {
      return t.slice(0, t.length - suf.length);
    }
  }
  return t;
}

/** normalized, stemmed word list — the shape both index and query take */
export function tokenize(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ").map(stem) : [];
}

// -------------------------------------------------------------------- index

export interface VerseRecord {
  chapter: string;   // "1 Nephi 3"
  verse: number;
  text: string;      // raw verse text (markdown stripped of number + anchor)
  anchor: string;    // "1ne-3-7"
  norm: string;
  tokens: string[];
}

export interface PageRecord {
  title: string;
  path: string;
  aliases: string[];
}

export interface ChapterRecord {
  title: string;
  norm: string;
  tokens: string[];
}

export interface SearchIndex {
  verses: VerseRecord[];
  pages: PageRecord[];
  chapters: ChapterRecord[];
}

/** `**7** And it came to pass... ^1ne-3-7` → a verse record (else null) */
const VERSE_LINE_RE = /^\*\*(\d+)\*\*\s+(.*?)\s*\^([a-z0-9]+(?:-\d+)+)\s*$/;
export function parseVerseLine(chapter: string, line: string): VerseRecord | null {
  const m = VERSE_LINE_RE.exec(line);
  if (!m) return null;
  const text = m[2]!;
  return {
    chapter, verse: Number(m[1]), text, anchor: m[3]!,
    norm: normalize(text), tokens: tokenize(text),
  };
}

// one index per session; concurrent callers share the same build
let builtIndex: SearchIndex | null = null;
let building: Promise<SearchIndex> | null = null;
const progressListeners: ((done: number, total: number) => void)[] = [];

export function searchIndexReady(): boolean { return builtIndex !== null; }

export function buildSearchIndex(
  app: App, onProgress?: (done: number, total: number) => void,
): Promise<SearchIndex> {
  if (builtIndex) return Promise.resolve(builtIndex);
  if (onProgress) progressListeners.push(onProgress);
  if (building) return building;
  building = (async () => {
    const all = app.vault.getMarkdownFiles();
    const canonical = all.filter(f => f.path.startsWith(CANONICAL_PREFIX));
    const verses: VerseRecord[] = [];
    const chapters: ChapterRecord[] = [];
    let done = 0;
    for (const f of canonical) {
      const title = f.basename;
      chapters.push({ title, norm: normalize(title), tokens: tokenize(title) });
      try {
        const md = await app.vault.cachedRead(f);
        for (const line of md.split("\n")) {
          const rec = parseVerseLine(title, line);
          if (rec) verses.push(rec);
        }
      } catch { /* unreadable chapter: search simply won't see it */ }
      done++;
      for (const p of progressListeners) p(done, canonical.length);
    }
    // library pages ride the metadata cache — no file reads needed
    const pages: PageRecord[] = [];
    for (const f of all) {
      if (!f.path.startsWith(LIBRARY_PREFIX)) continue;
      if (f.path.includes("01 Scriptures/")) continue;
      if (f.basename.startsWith("_")) continue;
      const fm = app.metadataCache.getFileCache(f)?.frontmatter;
      const raw = fm?.["aliases"] as unknown;
      const aliases = Array.isArray(raw) ? raw.map(String)
        : typeof raw === "string" ? [raw] : [];
      pages.push({ title: f.basename, path: f.path, aliases });
    }
    builtIndex = { verses, pages, chapters };
    building = null;
    progressListeners.length = 0;
    return builtIndex;
  })();
  return building;
}

// ------------------------------------------------------ reference parsing

export interface ParsedReference {
  bookName: string;
  title: string;        // chapter title, e.g. "1 Nephi 3"
  chapter: number;
  verse: number | null;
  anchor: string | null; // "1ne-3-7" when a verse is named
}

/** "1 ne" / "d&c" / "alma" → book, keyed by every normalized name form */
const BOOK_LOOKUP: Map<string, { name: string; prefix: string; slug: string; chapters: number }> = (() => {
  const m = new Map<string, { name: string; prefix: string; slug: string; chapters: number }>();
  for (const b of BOOKS) {
    for (const form of [b.name, b.prefix, b.slug, ...b.aliases]) {
      const key = normalize(form);
      if (key) m.set(key, b);
    }
  }
  return m;
})();

/** "alma 32", "1 ne 3:7", "d&c 4" → the chapter (and verse) they name */
export function parseReference(q: string): ParsedReference | null {
  const m = /^(.+?)[\s.]*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?$/.exec(q.trim());
  if (!m) return null;
  const book = BOOK_LOOKUP.get(normalize(m[1]!));
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const verse = m[3] ? Number(m[3]) : null;
  if (verse !== null && verse < 1) return null;
  return {
    bookName: book.name,
    title: `${book.prefix} ${chapter}`,
    chapter,
    verse,
    anchor: verse !== null ? `${book.slug}-${chapter}-${verse}` : null,
  };
}

// ------------------------------------------------------------------ scoring

/** Tiers: 1 exact phrase · 2 all tokens · 3 most tokens · 9 miss.
 * Within a tier the score decides; across tiers the tier always wins. */
export interface Scored { tier: number; score: number }

/** does the normalized query sit word-boundary-aligned inside norm? → index */
export function phraseAt(norm: string, qnorm: string): number {
  const hay = ` ${norm} `;
  const i = hay.indexOf(` ${qnorm} `);
  return i < 0 ? -1 : i; // index in padded string ≈ char position, good enough
}

function tokenMatches(token: string, q: string, isLast: boolean, prefixOk: boolean): boolean {
  return token === q || (isLast && prefixOk && q.length >= 2 && token.startsWith(q));
}

/** Score a token stream against query tokens.
 * All-token hits rank by the tightest window that holds every token, with
 * bonuses for query order, early arrival, and (mildly) short streams; the
 * last query token also matches as a prefix so typing feels alive. */
export function scoreTokens(tokens: string[], qtokens: string[], prefixOk: boolean): Scored {
  const n = qtokens.length;
  if (!n || !tokens.length) return { tier: 9, score: 0 };
  // presence check first — cheap rejection for the whole canon
  let present = 0;
  for (let qi = 0; qi < n; qi++) {
    const q = qtokens[qi]!;
    const isLast = qi === n - 1;
    for (const t of tokens) {
      if (tokenMatches(t, q, isLast, prefixOk)) { present++; break; }
    }
  }
  const need = n >= 2 ? Math.ceil(n / 2) : 1;
  if (present < need) return { tier: 9, score: 0 };
  const tier = present === n ? 2 : 3;
  // smallest window over the tokens we do have (one scan, last-seen per token)
  const last: number[] = new Array<number>(n).fill(-1);
  let bestSpan = Infinity;
  let bestStart = -1;
  let bestOrdered = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    for (let qi = 0; qi < n; qi++) {
      if (tokenMatches(t, qtokens[qi]!, qi === n - 1, prefixOk)) last[qi] = i;
    }
    let lo = Infinity, hi = -1, have = 0;
    for (let qi = 0; qi < n; qi++) {
      const p = last[qi]!;
      if (p < 0) continue;
      have++;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    if (have < present) continue;
    const span = hi - lo;
    if (span < bestSpan || (span === bestSpan && bestStart < 0)) {
      bestSpan = span;
      bestStart = lo;
      // query-order bonus: the last-seen positions climb with the query
      let ordered = true;
      for (let qi = 1; qi < n; qi++) {
        const a = last[qi - 1]!, b = last[qi]!;
        if (a >= 0 && b >= 0 && a > b) { ordered = false; break; }
      }
      bestOrdered = ordered;
    }
  }
  if (bestStart < 0) return { tier: 9, score: 0 };
  const slack = bestSpan - (present - 1);              // 0 = perfectly adjacent
  const score = 60 / (1 + slack)                        // tighter huddle, higher
    + (bestOrdered ? 12 : 0)                            // reads like the query
    + 10 / (1 + bestStart)                              // earlier in the verse
    + 6 / (1 + tokens.length / 12)                      // short verses edge ahead
    + present * 4;                                      // tier 3: more is better
  return { tier, score };
}

/** Full scoring for one verse-like text: exact phrase trumps token play. */
export function scoreText(norm: string, tokens: string[], qnorm: string, qtokens: string[]): Scored {
  if (qnorm) {
    const at = phraseAt(norm, qnorm);
    if (at >= 0) {
      return {
        tier: 1,
        score: 100 + 20 / (1 + at / 8) + 8 / (1 + tokens.length / 12),
      };
    }
  }
  return scoreTokens(tokens, qtokens, true);
}

/** Titles get the verse machinery plus a strong starts-with bonus;
 * an exact title is unbeatable. */
export function scoreTitle(title: string, qnorm: string, qtokens: string[]): Scored {
  return scoreTitleParts(normalize(title), tokenize(title), qnorm, qtokens);
}

export function scoreTitleParts(norm: string, tokens: string[], qnorm: string, qtokens: string[]): Scored {
  if (!norm) return { tier: 9, score: 0 };
  if (norm === qnorm) return { tier: 1, score: 400 };
  if (qnorm && norm.startsWith(qnorm)) return { tier: 1, score: 300 - norm.length };
  const base = scoreText(norm, tokens, qnorm, qtokens);
  if (base.tier >= 9) return base;
  const first = norm.split(" ")[0]!;
  const qFirst = qtokens[0] ?? "";
  const startsish = qFirst && (first === qFirst || first.startsWith(qFirst));
  return { tier: base.tier, score: base.score + (startsish ? 30 : 0) };
}

// ------------------------------------------------- snippets & highlighting

export interface TermRange { start: number; end: number }

interface RawWord { start: number; end: number; norm: string; stemmed: string }

function rawWords(text: string): RawWord[] {
  const out: RawWord[] = [];
  const re = /[A-Za-z0-9À-ɏ'’ʼ]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = normalize(m[0]!);
    if (!w) continue;
    out.push({ start: m.index, end: m.index + m[0]!.length, norm: w, stemmed: stem(w) });
  }
  return out;
}

/** Find highlightable ranges in RAW text: the whole phrase when it appears,
 * otherwise every word matching a query token (last token as prefix too). */
export function matchRanges(text: string, qnorm: string, qtokens: string[]): TermRange[] {
  const words = rawWords(text);
  const phrase = qnorm ? qnorm.split(" ") : [];
  if (phrase.length) {
    for (let i = 0; i + phrase.length <= words.length; i++) {
      let ok = true;
      for (let j = 0; j < phrase.length; j++) {
        if (words[i + j]!.norm !== phrase[j]!) { ok = false; break; }
      }
      if (ok) {
        return [{ start: words[i]!.start, end: words[i + phrase.length - 1]!.end }];
      }
    }
  }
  const ranges: TermRange[] = [];
  const n = qtokens.length;
  for (const w of words) {
    for (let qi = 0; qi < n; qi++) {
      if (tokenMatches(w.stemmed, qtokens[qi]!, qi === n - 1, true)) {
        ranges.push({ start: w.start, end: w.end });
        break;
      }
    }
  }
  return ranges;
}

const SNIPPET_LEN = 140;

/** Window the verse around its first match; ranges shift into snippet space. */
export function makeSnippet(text: string, ranges: TermRange[]): { snippet: string; ranges: TermRange[] } {
  if (text.length <= SNIPPET_LEN) return { snippet: text, ranges };
  if (!ranges.length) {
    const cut = text.lastIndexOf(" ", SNIPPET_LEN);
    return { snippet: `${text.slice(0, cut > 60 ? cut : SNIPPET_LEN)}…`, ranges: [] };
  }
  const first = ranges[0]!;
  let start = Math.max(0, first.start - 36);
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp >= 0 && sp < first.start) start = sp + 1;
  }
  let end = Math.min(text.length, start + SNIPPET_LEN);
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > start + SNIPPET_LEN / 2) end = sp;
  }
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const body = text.slice(start, end);
  const shift = start - prefix.length;
  const kept = ranges
    .filter(r => r.start >= start && r.end <= end)
    .map(r => ({ start: r.start - shift, end: r.end - shift }));
  return { snippet: prefix + body + suffix, ranges: kept };
}

// ------------------------------------------------------------------ search

export interface VerseHit {
  chapter: string;
  verse: number;
  anchor: string;
  snippet: string;
  ranges: TermRange[];
  tier: number;
  score: number;
}

export interface PageHit { title: string; path: string; tier: number; score: number }
export interface ChapterHit { title: string; tier: number; score: number }

export interface SearchResults {
  reference?: ParsedReference;
  verses: VerseHit[];
  pages: PageHit[];
  chapters: ChapterHit[];
}

const byRank = (a: Scored, b: Scored) => a.tier - b.tier || b.score - a.score;

export function smartSearch(q: string, index: SearchIndex): SearchResults {
  const qnorm = normalize(q);
  const qtokens = tokenize(q);
  const out: SearchResults = { verses: [], pages: [], chapters: [] };
  if (!qtokens.length) return out;
  const ref = parseReference(q);
  if (ref) out.reference = ref;

  // verses — score the whole canon, keep the best, snippet only the winners
  const vhits: { rec: VerseRecord; tier: number; score: number }[] = [];
  for (const rec of index.verses) {
    const s = scoreText(rec.norm, rec.tokens, qnorm, qtokens);
    if (s.tier < 9) vhits.push({ rec, tier: s.tier, score: s.score });
  }
  vhits.sort(byRank);
  for (const h of vhits.slice(0, 8)) {
    const { snippet, ranges } = makeSnippet(h.rec.text, matchRanges(h.rec.text, qnorm, qtokens));
    out.verses.push({
      chapter: h.rec.chapter, verse: h.rec.verse, anchor: h.rec.anchor,
      snippet, ranges, tier: h.tier, score: h.score,
    });
  }

  // pages — best of title and every alias
  const phits: { rec: PageRecord; tier: number; score: number }[] = [];
  for (const rec of index.pages) {
    let best: Scored = scoreTitle(rec.title, qnorm, qtokens);
    for (const a of rec.aliases) {
      const s = scoreTitle(a, qnorm, qtokens);
      if (byRank(s, best) < 0) best = s;
    }
    if (best.tier < 9) phits.push({ rec, tier: best.tier, score: best.score });
  }
  phits.sort(byRank);
  out.pages = phits.slice(0, 6).map(h => ({
    title: h.rec.title, path: h.rec.path, tier: h.tier, score: h.score,
  }));

  // chapter titles — only when the words themselves name a chapter
  const chits: { rec: ChapterRecord; tier: number; score: number }[] = [];
  for (const rec of index.chapters) {
    if (ref && rec.title === ref.title) continue;   // the reference row has it
    const s = scoreTitleParts(rec.norm, rec.tokens, qnorm, qtokens);
    if (s.tier < 9) chits.push({ rec, tier: s.tier, score: s.score });
  }
  chits.sort(byRank);
  out.chapters = chits.slice(0, 4).map(h => ({ title: h.rec.title, tier: h.tier, score: h.score }));

  return out;
}
