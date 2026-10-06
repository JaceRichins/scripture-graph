import { Platform, type Plugin } from "obsidian";
import type { SGState } from "../state";
import { adjacentChapterTitle, readingChapterTitle } from "./swipeNav";
import { historyBack, historyForward } from "./leafNav";

/** Desktop reading keys, scoped to the active page rather than the app's
 * editors, sidebars, search boxes or dialogs. */
export function registerKeyboardNav(plugin: Plugin, s: SGState, openChapter: (title: string) => void): void {
  if (Platform.isMobile) return;
  plugin.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
    if (document.body.classList.contains("sg-photo-only")) return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const focus = document.activeElement;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const editing = "input, textarea, select, [contenteditable]:not([contenteditable='false']), .cm-editor, [role='textbox'], [role='slider'], [role='combobox'], [role='tree'], [role='tablist']";
    if (target?.closest(editing) || focus?.closest(editing)) return;
    if (Array.from(document.querySelectorAll<HTMLElement>(".modal-container, .menu, .suggestion-container"))
      .some(el => el.getClientRects().length > 0)) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const leaf = s.app.workspace.activeLeaf;
    if (!leaf) return;
    const view = leaf.view;
    const kind = view.getViewType();
    if (!["markdown", "sg-library", "scripture-graph-reader", "scripture-graph-doc", "sg-timeline"].includes(kind)) return;
    if (kind === "markdown" && (view as unknown as { getMode?: () => string }).getMode?.() === "source") return;
    const root = view.containerEl;
    if (target?.closest(".workspace-leaf") && !root.contains(target)) return;
    if (focus?.closest(".workspace-leaf") && !root.contains(focus)) return;
    const consume = () => { event.preventDefault(); event.stopPropagation(); };

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      // The scroll container differs between Home, the chapter reader and
      // Obsidian reading view. Never scroll an inactive split or sidebar.
      const candidates = [...Array.from(root.querySelectorAll<HTMLElement>(".sg-libpage, .sg-doc, .sg-reader, .sg-tl-stream, .markdown-preview-view, .view-content")), root];
      const scroll = candidates.find(el => el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1
        && /auto|scroll|overlay/.test(getComputedStyle(el).overflowY));
      if (!scroll) return;
      consume();
      scroll.scrollBy({ top: event.key === "ArrowDown" ? 80 : -80, behavior: "instant" });
      return;
    }

    // Preserve horizontal navigation in wide tables and code blocks.
    for (let el = target; el && el !== root; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return;
    }
    const state = view.getState() as { chapter?: unknown };
    const chapter = kind === "scripture-graph-reader" && typeof state.chapter === "string"
      ? state.chapter : kind === "markdown" ? readingChapterTitle(s.app.workspace.getActiveFile()) : null;
    if (chapter) {
      const next = adjacentChapterTitle(chapter, event.key === "ArrowRight" ? 1 : -1);
      if (!next) return;
      consume();
      if (!event.repeat) openChapter(next);
    } else {
      // Other library pages use their existing back/forward history.
      if (event.repeat) { consume(); return; }
      const moved = event.key === "ArrowLeft" ? historyBack(leaf) : historyForward(leaf);
      if (moved) consume();
    }
  });
}
