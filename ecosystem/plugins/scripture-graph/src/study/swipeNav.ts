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
import { trace } from "./trace";

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

/** the CONTENT element under the finger that scrolls horizontally itself
 * (a wide table, a code block — their scroll wins), or null. The page-level
 * scrollers never count: a chapter with a few pixels of stray horizontal
 * overflow is still a page, not a carousel — treating it as one swallowed
 * every swipe on such chapters (found via the phone's own debug log). */
const PAGE_SCROLLERS = ["markdown-reading-view", "markdown-preview-view",
  "markdown-preview-sizer", "markdown-source-view", "cm-scroller",
  "view-content"];

function horizontalScrollerAt(el: HTMLElement | null): HTMLElement | null {
  let n = el, hops = 0;
  while (n && hops++ < 8) {
    if (PAGE_SCROLLERS.some(c => n!.classList?.contains(c))) return null;
    if (n.scrollWidth > n.clientWidth + 4) {
      const o = getComputedStyle(n).overflowX;
      if (o === "auto" || o === "scroll") return n;
    }
    n = n.parentElement;
  }
  return null;
}

/** a REAL page push, iOS-style. At commit, the current page's rendered DOM
 * is cloned into a pixel-perfect standing overlay — so the reader keeps
 * looking at the untouched old page while the destination loads and flips
 * to reading view UNDERNEATH it (every raw in-between state hidden). The
 * moment the new page is ready, the old one slides away with a dim and a
 * shadow seam while the new one pushes in at full width. Never a blank
 * frame: there is always a page on screen. */
let pushActive = false;

function turnWithPush(s: SGState, dir: 1 | -1, next: string,
  openChapter: (title: string) => void): void {
  const src = document.querySelector(".workspace-leaf.mod-active .view-content");
  if (pushActive || !(src instanceof HTMLElement)) {
    openChapter(next);
    return;
  }
  pushActive = true;
  const rect = src.getBoundingClientRect();
  const holder = document.body.createDiv({ cls: "sg-push-clone" });
  holder.style.left = `${rect.left}px`;
  holder.style.top = `${rect.top}px`;
  holder.style.width = `${rect.width}px`;
  holder.style.height = `${rect.height}px`;
  const clone = src.cloneNode(true) as HTMLElement;
  clone.style.width = "100%";
  clone.style.height = "100%";
  holder.appendChild(clone);
  // a clone starts unscrolled — carry the reader's place across
  const livePv = src.querySelector(".markdown-preview-view");
  const clonePv = clone.querySelector(".markdown-preview-view");
  if (livePv instanceof HTMLElement && clonePv instanceof HTMLElement) {
    clonePv.scrollTop = livePv.scrollTop;
  }
  // a small acknowledgment nudge so the finger feels heard while it loads
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) holder.addClass(dir === 1 ? "sg-push-ack-next" : "sg-push-ack-prev");

  const inCls = dir === 1 ? "sg-push-in-next" : "sg-push-in-prev";
  const outCls = dir === 1 ? "sg-push-out-next" : "sg-push-out-prev";
  const t0 = Date.now();
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    pushActive = false;
    if (still) {
      holder.remove();
      return;
    }
    holder.addClass(outCls);                     // old page slides away…
    document.body.addClass(inCls);               // …as the new one pushes in
    window.setTimeout(() => {
      holder.remove();
      document.body.removeClass(inCls);
    }, 300);
  };
  openChapter(next);
  const ready = (): boolean => {
    if (readingChapterTitle(s.app.workspace.getActiveFile()) !== next) return false;
    const pv = document.querySelector(
      ".workspace-leaf.mod-active .markdown-preview-view");
    return pv instanceof HTMLElement && pv.clientHeight > 0;
  };
  const tick = () => {
    if (ready()) { window.requestAnimationFrame(done); return; }
    if (Date.now() - t0 > 800) { done(); return; }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

export function registerSwipeNav(
  plugin: Plugin, s: SGState, openChapter: (title: string) => void,
): void {
  if (!Platform.isMobile) return;

  // Obsidian's drawers are silenced at the source: chapter reading pages
  // carry data-ignore-swipe (set in main.ts), the same opt-out gate the
  // app's own sliders and canvas use, so its swipe recognizer never fires
  // there. That leaves this detector free to be SIMPLE — two passive
  // listeners, no event interception, nothing that can fight the browser:
  // note where the finger landed, and on lift, decide if it was a flick.
  let start: { x: number; y: number; t: number } | null = null;

  plugin.registerDomEvent(document, "touchstart", (evt: TouchEvent) => {
    start = null;
    if (s.device.swipeNav === false) return;                 // per-device off
    if (evt.touches.length !== 1) return;
    if (document.body.hasClass("sg-selecting")) {            // mid-markup
      trace("swipe.skip", { why: "selecting" });
      return;
    }
    const t = evt.touches[0]!;
    const target = evt.target as HTMLElement | null;
    // the gesture belongs to a CHAPTER PAGE: reading view always; the
    // editable view too, but only while the keyboard is down (a mode flip
    // can race a fast navigation — the page must never go gesture-dead)
    const reading = !!target?.closest(".markdown-reading-view, .markdown-preview-view");
    const sourcing = !reading && !!target?.closest(".markdown-source-view")
      && !document.activeElement?.closest(".cm-editor");
    if (!reading && !sourcing) {
      if (target?.closest(".workspace-leaf")) {
        trace("swipe.skip", { why: "not-reading", el: target?.className?.slice?.(0, 40) ?? "?" });
      }
      return;
    }
    if (target!.closest(".sg-studybar, .modal, .menu, .sg-nav-fab, .sg-back-pill, .sg-tl")) {
      trace("swipe.skip", { why: "ui-chrome" });
      return;
    }
    const scroller = horizontalScrollerAt(target);
    if (scroller) {
      trace("swipe.skip", {
        why: "h-scroller",
        el: (scroller.className || scroller.tagName).slice(0, 40),
      });
      return;
    }
    // the outer edges stay Obsidian's (system back gestures live there too)
    if (t.clientX < 40 || t.clientX > window.innerWidth - 40) return;
    start = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });

  plugin.registerDomEvent(document, "touchend", (evt: TouchEvent) => {
    const s0 = start;
    start = null;
    if (!s0) return;
    const t = evt.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    const dt = Date.now() - s0.t;
    // a clear horizontal flick — comfortable, since nothing competes here
    if (dt > 550 || Math.abs(dx) < 80 || Math.abs(dy) > 70
      || Math.abs(dx) < Math.abs(dy) * 1.8) {
      if (Math.abs(dx) >= 40) {
        trace("swipe.miss", { dx: Math.round(dx), dy: Math.round(dy), dt });
      }
      return;
    }
    // a REAL selection blocks the turn; a stale empty one (phones leave
    // these behind after taps) must not wedge the gesture forever
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      trace("swipe.skip", { why: "selection", len: sel.toString().length });
      return;
    }
    const title = readingChapterTitle(s.app.workspace.getActiveFile());
    if (!title) {
      trace("swipe.skip", { why: "no-chapter", file: s.app.workspace.getActiveFile()?.basename ?? "none" });
      return;
    }
    const dir: 1 | -1 = dx < 0 ? 1 : -1;
    const next = adjacentChapterTitle(title, dir);
    if (!next) {
      trace("swipe.skip", { why: "canon-end", at: title });
      return;
    }
    try { navigator.vibrate?.(8); } catch { /* no haptics */ }
    trace("swipe.turn", { from: title, to: next, dx: Math.round(dx), dt });
    turnWithPush(s, dir, next, openChapter);
  }, { passive: true });

  plugin.registerDomEvent(document, "touchcancel", () => { start = null; },
    { passive: true });
}
