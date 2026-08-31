/** 👉 Swipe navigation — turn the page like a book.
 *
 * On the phone, a horizontal swipe on a reading page moves one chapter:
 * left = next, right = previous, flowing straight across book boundaries
 * (Genesis 50 → Exodus 1) through the whole canon, always landing on the
 * personal My Study page.
 *
 * Deliberately picky about what counts as a page-turn, because this gesture
 * lives with others: it ignores swipes that start on the StudyBar (its theme
 * row scrolls horizontally), inside any modal/sheet, near the screen edges
 * (Obsidian's sidebar gestures), while a selection is active, or when the
 * finger's path is more scroll than swipe. */
import { Platform, type Plugin, type TFile } from "obsidian";
import { BOOKS, chapterIdFromTitle } from "@scripture-graph/core-sdk";
import { ANNOTATED_PREFIX, CANONICAL_PREFIX, PERSONAL_PREFIX, SGState } from "../state";

/** "Genesis 50" + next → "Exodus 1"; null at the canon's ends */
export function adjacentChapterTitle(title: string, dir: 1 | -1): string | null {
  const id = chapterIdFromTitle(title);
  if (!id) return null;
  const dash = id.lastIndexOf("-");
  const bookSlug = id.slice(0, dash);
  const ch = Number(id.slice(dash + 1));
  const bi = BOOKS.findIndex(b => b.slug === bookSlug);
  if (bi < 0) return null;
  const book = BOOKS[bi]!;
  const target = ch + dir;
  if (target >= 1 && target <= book.chapters) {
    return `${book.prefix} ${target}`;
  }
  const nb = BOOKS[bi + dir];
  if (!nb) return null;                       // the canon has a first and a last page
  return dir === 1 ? `${nb.prefix} 1` : `${nb.prefix} ${nb.chapters}`;
}

function readingChapterTitle(f: TFile | null): string | null {
  if (!f) return null;
  if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
    return f.basename.slice(0, -" - My Notes".length);
  }
  if (f.path.startsWith(CANONICAL_PREFIX)) return f.basename;
  if (f.path.startsWith(ANNOTATED_PREFIX)) {
    return f.basename.replace(/ \(Annotated\)$/, "");
  }
  return null;
}

export function registerSwipeNav(
  plugin: Plugin, s: SGState, openChapter: (title: string) => void,
): void {
  if (!Platform.isMobile) return;

  let start: { x: number; y: number; t: number } | null = null;

  plugin.registerDomEvent(document, "touchstart", (evt: TouchEvent) => {
    start = null;
    if (s.device.swipeNav === false) return;                 // per-device off
    if (evt.touches.length !== 1) return;
    const t = evt.touches[0]!;
    const target = evt.target as HTMLElement | null;
    // the gesture belongs to READING and nowhere else: it must start on a
    // rendered scripture surface — never the timeline, navigator, sheets,
    // or any other view where a horizontal swipe means something different
    if (!target?.closest(".markdown-reading-view, .markdown-preview-view")) return;
    // never inside the StudyBar (horizontal theme scroller), sheets, menus
    if (target.closest(".sg-studybar, .modal, .menu, .sg-nav-fab, .sg-back-pill, .sg-tl")) return;
    // leave a wide margin for Obsidian's own sidebar-drawer gestures
    if (t.clientX < 44 || t.clientX > window.innerWidth - 44) return;
    start = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });

  plugin.registerDomEvent(document, "touchend", (evt: TouchEvent) => {
    const s0 = start;
    start = null;
    if (!s0) return;
    if (document.body.hasClass("sg-selecting")) return;      // mid-markup
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;                     // text selection
    const t = evt.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    const dt = Date.now() - s0.t;
    // a DECISIVE horizontal flick — deliberately stricter than the drawer
    // gestures it lives beside, so a casual drag never turns the page
    if (dt > 500 || Math.abs(dx) < 96 || Math.abs(dy) > 60
      || Math.abs(dx) < Math.abs(dy) * 2) return;
    const title = readingChapterTitle(s.app.workspace.getActiveFile());
    if (!title) return;
    const next = adjacentChapterTitle(title, dx < 0 ? 1 : -1);
    if (!next) return;
    try { navigator.vibrate?.(8); } catch { /* no haptics */ }
    openChapter(next);
  }, { passive: true });
}
