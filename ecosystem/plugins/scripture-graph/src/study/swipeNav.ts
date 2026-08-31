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

export function readingChapterTitle(f: TFile | null): string | null {
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

/** does any ancestor up to the reading view scroll horizontally itself?
 * (tables, code blocks, the connections strip — their scroll wins) */
function inHorizontalScroller(el: HTMLElement | null): boolean {
  let n = el, hops = 0;
  while (n && hops++ < 8) {
    if (n.classList?.contains("markdown-reading-view")) return false;
    if (n.scrollWidth > n.clientWidth + 4) {
      const o = getComputedStyle(n).overflowX;
      if (o === "auto" || o === "scroll") return true;
    }
    n = n.parentElement;
  }
  return false;
}

export function registerSwipeNav(
  plugin: Plugin, s: SGState, openChapter: (title: string) => void,
): void {
  if (!Platform.isMobile) return;

  // A swipe can serve only one master. Obsidian's sidebar drawers listen to
  // the same finger — and they may be listening to EITHER event model
  // (touch and pointer events both fire for one physical gesture), so this
  // arbiter watches BOTH in the capture phase: it reads the first few
  // pixels, decides horizontal-vs-vertical ONCE, and on claiming a
  // horizontal swipe over a reading page it kills both streams with
  // stopImmediatePropagation — the drawers never hear about it. A vertical
  // start releases instantly and native scrolling is never touched.
  // (touch-action: pan-y on the reading text, in styles.css, closes the
  // third door: the browser itself refuses native horizontal panning.)
  let start: { x: number; y: number; t: number } | null = null;
  let claimed = false;

  const reset = () => { start = null; claimed = false; };

  const tryStart = (x: number, y: number, target: HTMLElement | null): void => {
    if (s.device.swipeNav === false) return;                 // per-device off
    if (document.body.hasClass("sg-selecting")) return;      // mid-markup
    // the gesture belongs to READING and nowhere else
    if (!target?.closest(".markdown-reading-view, .markdown-preview-view")) return;
    if (target.closest(".sg-studybar, .modal, .menu, .sg-nav-fab, .sg-back-pill, .sg-tl")) return;
    if (inHorizontalScroller(target)) return;
    // the outer edges stay Obsidian's (system back gestures live there too)
    if (x < 40 || x > window.innerWidth - 40) return;
    start = { x, y, t: Date.now() };
  };

  /** shared decision: true = claimed (silence this event), false = pass */
  const arbitrate = (x: number, y: number): boolean => {
    if (!start) return false;
    const dx = x - start.x;
    const dy = y - start.y;
    if (!claimed) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        reset();                                             // it's a scroll
        return false;
      }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        claimed = true;                                      // it's a page-turn
      } else {
        return false;                                        // too soon to say
      }
    }
    return true;
  };

  plugin.registerDomEvent(document, "touchstart", (evt: TouchEvent) => {
    reset();
    if (evt.touches.length !== 1) return;
    const t = evt.touches[0]!;
    tryStart(t.clientX, t.clientY, evt.target as HTMLElement | null);
  }, { passive: true, capture: true });

  plugin.registerDomEvent(document, "touchmove", (evt: TouchEvent) => {
    if (!start) return;
    const t = evt.touches[0];
    if (!t || evt.touches.length !== 1) { reset(); return; }
    if (!arbitrate(t.clientX, t.clientY)) return;
    evt.stopImmediatePropagation();
    if (evt.cancelable) evt.preventDefault();
  }, { passive: false, capture: true });

  // the same claim, mirrored onto the pointer-event stream
  plugin.registerDomEvent(document, "pointermove", (evt: PointerEvent) => {
    if (!start || evt.pointerType !== "touch" || !evt.isPrimary) return;
    if (!arbitrate(evt.clientX, evt.clientY)) return;
    evt.stopImmediatePropagation();
    if (evt.cancelable) evt.preventDefault();
  }, { passive: false, capture: true });

  plugin.registerDomEvent(document, "pointerup", (evt: PointerEvent) => {
    if (claimed && evt.pointerType === "touch") evt.stopImmediatePropagation();
  }, { passive: true, capture: true });

  plugin.registerDomEvent(document, "touchend", (evt: TouchEvent) => {
    const s0 = start;
    const wasClaimed = claimed;
    reset();
    if (!s0 || !wasClaimed) return;
    evt.stopImmediatePropagation();
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;                     // text selection
    const t = evt.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    const dt = Date.now() - s0.t;
    // we own the gesture now, so the commit can be gentle: a clear flick,
    // not a wrestling hold
    if (dt > 600 || Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const title = readingChapterTitle(s.app.workspace.getActiveFile());
    if (!title) return;
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const next = adjacentChapterTitle(title, dir);
    if (!next) return;
    try { navigator.vibrate?.(8); } catch { /* no haptics */ }
    // the new page slides in from the side the finger pointed
    const cls = dir === 1 ? "sg-turn-next" : "sg-turn-prev";
    document.body.addClass(cls);
    window.setTimeout(() => document.body.removeClass(cls), 320);
    openChapter(next);
  }, { passive: true, capture: true });

  plugin.registerDomEvent(document, "touchcancel", () => reset(),
    { passive: true, capture: true });
  plugin.registerDomEvent(document, "pointercancel", () => reset(),
    { passive: true, capture: true });
}
