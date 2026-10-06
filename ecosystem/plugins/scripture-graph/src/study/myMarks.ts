/** My highlights & notes: every mark I have made on scripture, in one place,
 * in canon order or most recent first, filterable by kind and by words.
 *
 * Read-only over the annotations already on this device -- nothing is
 * migrated, rewritten or re-saved, so every existing mark stays exactly as it
 * is. Only MY marks are listed (the local store also holds what others have
 * shared with me; those stay in the family lens and the verse sheet). */
import { BOOK_BY_SLUG, chapterTitle, parseVerseId, type Annotation } from "@scripture-graph/core-sdk";
import { isConnectionNote, connectionOf } from "./connect";
import { COLOR_HEX, noteBody } from "../social/annotations";
import { themeSpec } from "./themeLibrary";

export type MarkKind = "highlight" | "theme" | "note" | "connection" | "flashcard";
export interface MarkEntry {
  id: string; kind: MarkKind; anchor: string; ref: string; chapter: string;
  color: string | null; style: string | null; theme: string | null;
  /** the phrase marked, or the note's own words */
  text: string | null; updated: string; order: number;
}

const KIND_LABEL: Record<MarkKind | "all", string> = {
  all: "All", highlight: "Highlights", note: "Notes", theme: "Themes", connection: "Connections", flashcard: "Flashcards",
};

/** my marks on verses, newest-first within nothing -- the caller sorts */
export function collectMarks(all: Annotation[], me: string | null): MarkEntry[] {
  const out: MarkEntry[] = [];
  for (const a of all) {
    if (a.deleted_at) continue;
    if (a.author_user_id !== me && a.author_user_id !== null) continue;
    const v = parseVerseId(a.anchor_id);
    if (!v) continue;                      // bookmarks, pages, playlists, study blocks: not scripture marks
    const book = BOOK_BY_SLUG.get(v.bookSlug)!;
    const chapter = chapterTitle(v.bookSlug, v.chapter)!;
    let kind: MarkKind | null = null;
    let text: string | null = null;
    if (a.annotation_type === "highlight") { kind = a.theme && !a.selected_text ? "theme" : "highlight"; text = a.selected_text; }
    else if (a.annotation_type === "note") {
      if (a.content.startsWith("Song:") || a.content.startsWith("⚠ Conflict copy") || !a.content.trim()) continue;
      if (isConnectionNote(a)) { kind = "connection"; const c = connectionOf(a.content); text = c ? `${c.target}${c.why ? ` — ${c.why}` : ""}` : a.content; }
      else { kind = "note"; text = noteBody(a.content); }
    }
    else if (a.annotation_type === "study-marker") {
      kind = "flashcard";
      try { text = String((JSON.parse(a.content) as { back?: unknown }).back ?? "") || null; } catch { text = null; }
    }
    if (!kind) continue;
    out.push({ id: a.annotation_id, kind, anchor: a.anchor_id, ref: `${chapter}:${v.verse}`, chapter,
      color: a.color, style: a.style, theme: a.theme, text, updated: a.updated_at,
      order: (book.volumeSeq * 1000 + book.bookSeq) * 1_000_000 + v.chapter * 1000 + v.verse });
  }
  return out;
}

export interface MarksIO {
  load(): Promise<{ all: Annotation[]; me: string | null }>;
  /** the verse's words, when the chapter is on this device */
  verseText(anchor: string): Promise<string | null>;
  open(link: string): void;
  themes(): { name: string; color: string; style?: string }[];
}

export function renderMyMarks(c: HTMLElement, io: MarksIO, state: { kind?: MarkKind | "all"; query?: string; recent?: boolean }): void {
  c.createEl("p", { cls: "sg-collection-description", text: "Every highlight, note, theme and connection you have made, in one place." });
  const tools = c.createDiv({ cls: "sg-marks-tools" });
  const input = tools.createEl("input", { cls: "sg-nav-filter sg-marks-filter",
    attr: { type: "search", placeholder: "Find in your marks…", "aria-label": "Find in your highlights and notes" } });
  input.value = state.query ?? "";
  const chips = c.createDiv({ cls: "sg-marks-chips", attr: { role: "tablist", "aria-label": "Show" } });
  const sortBtn = tools.createEl("button", { cls: "sg-marks-sort", text: state.recent ? "Recent" : "By book",
    attr: { "aria-label": "Change the order" } });
  const list = c.createDiv({ cls: "sg-marks-list" });
  let entries: MarkEntry[] = [];
  const words = new Map<string, string | null>();

  const draw = () => {
    chips.empty();
    const counts: Record<string, number> = { all: entries.length };
    for (const e of entries) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    for (const k of ["all", "highlight", "note", "theme", "connection", "flashcard"] as const) {
      if (k !== "all" && !counts[k]) continue;
      const on = (state.kind ?? "all") === k;
      const chip = chips.createEl("button", { cls: `sg-marks-chip${on ? " sg-marks-chip-on" : ""}`,
        text: `${KIND_LABEL[k]} ${counts[k] ?? 0}`, attr: { role: "tab", "aria-selected": String(on) } });
      chip.onclick = () => { state.kind = k; draw(); };
    }
    list.empty();
    const q = (state.query ?? "").trim().toLowerCase();
    const shown = entries
      .filter(e => (state.kind ?? "all") === "all" || e.kind === state.kind)
      .filter(e => !q || [e.ref, e.text, e.theme, words.get(e.anchor)].some(t => t?.toLowerCase().includes(q)))
      .sort((a, b) => state.recent ? b.updated.localeCompare(a.updated) : a.order - b.order || b.updated.localeCompare(a.updated));
    if (!entries.length) { list.createDiv({ cls: "sg-marks-empty", text: "Nothing marked yet. Tap a verse number while reading to highlight it or add a note." }); return; }
    if (!shown.length) { list.createDiv({ cls: "sg-marks-empty", text: "No marks match." }); return; }
    let group = "";
    for (const e of shown.slice(0, 400)) {
      const head = state.recent ? "" : e.chapter;
      if (head && head !== group) { group = head; list.createDiv({ cls: "sg-nav-sect sg-marks-group", text: head }); }
      const row = list.createDiv({ cls: "sg-nav-row sg-marks-row", attr: { role: "button", tabindex: "0", "aria-label": `${KIND_LABEL[e.kind]} on ${e.ref}` } });
      const sw = row.createSpan({ cls: `sg-marks-swatch sg-marks-${e.kind}` });
      const hex = e.kind === "theme" && e.theme ? themeSpec(e.theme, io.themes(), COLOR_HEX).c1 : e.color ? (COLOR_HEX[e.color] ?? e.color) : null;
      if (hex) sw.style.setProperty("--sg-mark", hex);
      sw.setText(e.kind === "note" ? "📝" : e.kind === "connection" ? "⇄" : e.kind === "flashcard" ? "🃏" : e.kind === "theme" ? (e.theme ? themeSpec(e.theme, io.themes(), COLOR_HEX).emoji : "🏷") : "");
      const col = row.createDiv({ cls: "sg-nav-gcol" });
      const top = col.createDiv({ cls: "sg-nav-name sg-marks-ref", text: e.ref });
      if (e.kind === "theme" && e.theme) top.createSpan({ cls: "sg-marks-theme", text: ` · ${e.theme}` });
      const verse = words.get(e.anchor);
      const quote = e.kind === "highlight" && e.text ? e.text : verse;
      if (quote) col.createDiv({ cls: "sg-nav-snip sg-marks-quote", text: quote.length > 180 ? `${quote.slice(0, 177)}…` : quote });
      if (e.kind === "note" || e.kind === "connection" || e.kind === "flashcard") {
        if (e.text) col.createDiv({ cls: "sg-marks-words", text: e.text });
      }
      const go = () => io.open(`${e.chapter}#^${e.anchor}`);
      row.onclick = go;
      row.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } };
    }
    if (shown.length > 400) list.createDiv({ cls: "sg-marks-empty", text: `Showing the first 400 of ${shown.length}. Narrow it with the chips or the search.` });
  };

  let timer: number | null = null;
  input.oninput = () => {
    state.query = input.value;
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(draw, 120);
  };
  sortBtn.onclick = () => { state.recent = !state.recent; sortBtn.setText(state.recent ? "Recent" : "By book"); draw(); };

  list.createDiv({ cls: "sg-marks-empty", text: "Gathering your marks…" });
  void io.load().then(async ({ all, me }) => {
    entries = collectMarks(all, me);
    draw();
    // the verse's words arrive after the list, so the list never waits on them
    for (const e of entries) if (!words.has(e.anchor)) words.set(e.anchor, await io.verseText(e.anchor).catch(() => null));
    if (list.isConnected) draw();
  }).catch(() => { list.empty(); list.createDiv({ cls: "sg-marks-empty", text: "Your marks couldn't be read on this device." }); });
}
