/** Collapse not-yet-researched sections in the reading view.
 *
 * Engine notes are a fixed template of managed sections, and a section nobody
 * has researched yet renders `_Not yet developed._`. Across the corpus that is
 * the great majority of every study guide, so opening a chapter shows a wall of
 * headings saying nothing — the first impression of almost the whole vault.
 *
 * This hides those sections behind one quiet line. It does NOT delete them:
 * the heading stays, gains a "not yet developed" badge, and clicking it reveals
 * the section again. What is missing is information too, and hiding it outright
 * would tell the reader the guide is complete when it is not.
 *
 * The pairing logic (which heading owns which blocks) lives in the SDK as a
 * pure function; this file only maps elements to blocks and applies the plan.
 */
import { type MarkdownPostProcessorContext, type MarkdownView, type Plugin } from "obsidian";
import { type Block, planEmptySections } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, LIBRARY_PREFIX, type SGState } from "../state";

const CLS_SECTION = "sg-empty-section";
const CLS_HIDDEN = "sg-empty-hidden";
const CLS_BADGE = "sg-empty-badge";
const ATTR_DONE = "data-sg-empty-pass";

/** Heading level of a rendered block, or null when it is content.
 *
 * Reading view wraps each top-level block in a div (`.el-h2`, `.el-p`, …), so
 * the heading is usually one level down rather than the element itself. */
function headingLevel(el: Element): number | null {
  const tag = el.tagName.toLowerCase();
  let m = /^h([1-6])$/.exec(tag);
  if (m) return Number(m[1]);
  const inner = el.querySelector("h1, h2, h3, h4, h5, h6");
  // only a wrapper whose whole content is the heading counts; a callout that
  // happens to contain an h3 is content
  if (inner && inner.parentElement === el && el.childElementCount === 1) {
    m = /^h([1-6])$/.exec(inner.tagName.toLowerCase());
    if (m) return Number(m[1]);
  }
  return null;
}

function headingEl(el: Element): HTMLElement {
  const inner = el.querySelector("h1, h2, h3, h4, h5, h6");
  return (inner as HTMLElement | null) ?? (el as HTMLElement);
}

/** Apply the collapse to one rendered container. Idempotent and cheap to
 * repeat: Obsidian re-renders blocks incrementally as you scroll. */
export function collapseEmptySections(container: HTMLElement): number {
  const els = Array.from(container.children) as HTMLElement[];
  if (!els.length) return 0;
  const blocks: Block[] = els.map(el => ({
    level: headingLevel(el),
    text: el.textContent ?? "",
  }));

  // start from a clean slate so a section that just gained content re-opens
  for (const el of els) {
    el.removeClass(CLS_HIDDEN);
    el.removeClass(CLS_SECTION);
  }

  let collapsed = 0;
  for (const section of planEmptySections(blocks)) {
    const head = els[section.heading]!;
    head.addClass(CLS_SECTION);
    for (const i of section.body) els[i]!.addClass(CLS_HIDDEN);
    collapsed++;

    const h = headingEl(head);
    if (!h.querySelector(`.${CLS_BADGE}`)) {
      const badge = h.createSpan({ cls: CLS_BADGE, text: "not yet developed" });
      badge.setAttr("aria-label", "This section has not been researched yet — click to show");
      const toggle = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const showing = head.hasClass("sg-empty-open");
        head.toggleClass("sg-empty-open", !showing);
        for (const i of section.body) els[i]!.toggleClass(CLS_HIDDEN, showing);
      };
      badge.addEventListener("click", toggle);
      h.addEventListener("click", toggle);
    }
  }
  container.setAttribute(ATTR_DONE, String(collapsed));
  return collapsed;
}

/** Undo the collapse in one container — used when the setting is turned off,
 * so the change is visible without reopening the note. */
export function uncollapse(container: HTMLElement): void {
  for (const el of Array.from(container.children) as HTMLElement[]) {
    el.removeClass(CLS_HIDDEN);
    el.removeClass(CLS_SECTION);
    el.removeClass("sg-empty-open");
    el.querySelectorAll(`.${CLS_BADGE}`).forEach(b => b.remove());
  }
  container.removeAttribute(ATTR_DONE);
}


/** Notes this applies to: engine-written pages, never canonical scripture and
 * never the reader's own writing. */
export function shouldCollapse(app: Plugin["app"], sourcePath: string): boolean {
  if (!sourcePath || sourcePath.startsWith(CANONICAL_PREFIX)) return false;
  if (!sourcePath.startsWith(LIBRARY_PREFIX)) return false;
  const fm = app.metadataCache.getCache(sourcePath)?.frontmatter as
    { mutable?: string } | undefined;
  return fm?.mutable === "ai";
}

export function registerEmptySectionCollapse(plugin: Plugin, s: SGState): void {
  plugin.registerMarkdownPostProcessor(
    (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      if (!s.settings.collapseEmptySections) return;
      if (!shouldCollapse(plugin.app, ctx.sourcePath)) return;
      // The processor is handed one block at a time and the element is not in
      // the document yet, so the cross-block pairing has to wait a frame for
      // its siblings to exist.
      window.requestAnimationFrame(() => {
        const container = el.closest(".markdown-preview-sizer") as HTMLElement | null;
        if (container) collapseEmptySections(container);
      });
    });

  // Re-run when a note is opened or panes change: incremental re-renders can
  // land after the last post-processor call, and toggling a pane back to
  // reading mode does not re-run the processors for blocks already built.
  const sweep = () => {
    for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view as MarkdownView;
      if (!view.file || !shouldCollapse(plugin.app, view.file.path)) continue;
      view.containerEl.querySelectorAll(".markdown-preview-sizer").forEach(c => {
        if (s.settings.collapseEmptySections) collapseEmptySections(c as HTMLElement);
        else uncollapse(c as HTMLElement);
      });
    }
  };
  // turning the setting off has to un-fold what is already on screen, not just
  // stop folding the next render
  s.onChange.push(sweep);
  plugin.registerEvent(plugin.app.workspace.on("layout-change", sweep));
  plugin.registerEvent(plugin.app.workspace.on("file-open", () =>
    window.setTimeout(sweep, 50)));
}
