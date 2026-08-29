/** In-place reading-view integration: decorate canonical verses wherever they
 * render (plain view, My Notes embeds, reader), stamp stable data-verse-id
 * attributes, and route taps/selections to the StudyBar. Desktop right-click
 * keeps a full context menu as a power path. Nothing here blocks link taps
 * or native text selection. */
import { Menu, Notice, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { Visibility } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, SGState } from "../state";
import { AnnotationService, COLORS, NoteModal, NotesPopover, decorateVerse } from "./annotations";
import type { StudyBar } from "../study/studyBar";

export interface SelectionHit {
  verseId: string;
  verseText: string;
  selected: string | null;
}

export function registerReadingIntegration(
  plugin: Plugin, s: SGState, svc: AnnotationService, bar: StudyBar,
  openAsk: (prompt: string, anchor: string | null) => void,
): void {
  // ---- decorations + verse-id stamping -----------------------------------
  plugin.registerMarkdownPostProcessor(async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
    if (!ctx.sourcePath?.startsWith(CANONICAL_PREFIX)) return;
    const fm = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter as
      { slug?: string } | undefined;
    const slug = fm?.slug;
    if (!slug) return;
    const anchors: string[] = [];
    const paragraphs: { p: HTMLElement; verseId: string }[] = [];
    el.querySelectorAll("p").forEach(p => {
      const strong = p.querySelector("strong");
      const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
      if (!Number.isFinite(n)) return;
      const verseId = `${slug}-${n}`;
      p.setAttribute("data-verse-id", verseId);   // stable hook for the StudyBar
      anchors.push(verseId);
      paragraphs.push({ p: p as HTMLElement, verseId });
    });
    for (const { p, verseId } of paragraphs) {
      const mine = await svc.mine(verseId);
      decorateVerse(s, svc, p, verseId, mine, svc.social(verseId));
    }
    // social refresh in background, then re-decorate on next render
    void svc.refreshSocial(anchors);
  });

  // ---- taps + long-press selections → StudyBar (gesture-safe wiring) -----
  bar.attach(plugin);

  // ---- desktop right-click power menu ------------------------------------
  plugin.registerDomEvent(document, "contextmenu", (evt) => {
    const hit = resolveSelection(s, evt);
    if (!hit) return;
    evt.preventDefault();
    evt.stopPropagation();
    buildSelectionMenu(s, svc, hit, openAsk).showAtMouseEvent(evt);
  });
}

export function resolveSelection(s: SGState, evt: MouseEvent | null): SelectionHit | null {
  const sel = window.getSelection();
  let target: Element | null = evt?.target instanceof Element ? evt.target : null;
  if (!target && sel?.anchorNode) {
    target = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement;
  }
  if (!target || target.closest(".cm-editor")) return null;
  if (!target.closest(".markdown-preview-view, .markdown-embed, .sg-reader")) return null;
  const p = target.closest("p") ?? sel?.anchorNode?.parentElement?.closest("p") ?? null;
  if (!p) return null;

  // decorated verses carry data-verse-id (stamped by the post-processor / reader)
  const direct = (p as HTMLElement).getAttribute("data-verse-id")
    ?? (target.closest("[data-verse-id]") as HTMLElement | null)?.getAttribute("data-verse-id");
  let verseId: string | null = direct ?? null;
  if (!verseId) {
    const embed = target.closest(".internal-embed[src]");
    const src = embed?.getAttribute("src") ?? null;
    if (src?.includes("#^")) verseId = src.split("#^")[1]!.trim();
    else {
      const strong = p.querySelector("strong");
      const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
      if (!Number.isFinite(n)) return null;
      let slug: string | null = null;
      if (src) {
        const dest = s.app.metadataCache.getFirstLinkpathDest(src.split("#")[0]!, "");
        if (dest && !dest.path.startsWith(CANONICAL_PREFIX)) return null;
        slug = dest ? (s.app.metadataCache.getFileCache(dest)?.frontmatter as { slug?: string })?.slug ?? null : null;
      } else {
        const f = s.app.workspace.getActiveFile();
        if (!f || !f.path.startsWith(CANONICAL_PREFIX)) return null;
        slug = (s.app.metadataCache.getFileCache(f)?.frontmatter as { slug?: string })?.slug ?? null;
      }
      if (!slug) return null;
      verseId = `${slug}-${n}`;
    }
  }
  if (!verseId || verseId.split("-").length < 3) return null;
  const selected = sel && !sel.isCollapsed ? sel.toString().trim() : null;
  const clone = p.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sgh-note-icon, .sg-badge").forEach(e => e.remove());
  const verseText = (clone.textContent ?? "").replace(/^\s*\d+\s*/, "").trim() || null;
  return {
    verseId,
    verseText: verseText ?? "",
    selected: selected && selected.length >= 3 && selected.length <= 600 ? selected : null,
  };
}

export function buildSelectionMenu(
  s: SGState, svc: AnnotationService, hit: SelectionHit,
  openAsk: (prompt: string, anchor: string | null) => void,
): Menu {
  const menu = new Menu();
  menu.addItem(i => i.setTitle("View notes on this verse").setIcon("sticky-note")
    .onClick(() => new NotesPopover(s, svc, hit.verseId).open()));
  menu.addSeparator();
  for (const c of COLORS) {
    menu.addItem(i => i.setTitle(`Highlight ${c}`).setIcon("highlighter").onClick((e) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addHighlight(hit.verseId, c, hit.verseText, hit.selected, vis, gid);
        new Notice(`Highlighted — ${label}`);
      }).showAtMouseEvent(e as MouseEvent);
    }));
  }
  menu.addSeparator();
  menu.addItem(i => i.setTitle("Add note…").setIcon("pencil").onClick(() => {
    new NoteModal(s, hit.verseId, (text) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addNote(hit.verseId, text, hit.selected, vis, gid);
        new Notice(`Note saved — ${label}`);
      }).showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    }).open();
  }));
  menu.addSeparator();
  menu.addItem(i => i.setTitle("✨ Ask AI about this verse").setIcon("sparkles").onClick(() => {
    openAsk(hit.selected ? `About "${hit.selected}" — ` : "", hit.verseId);
  }));
  return menu;
}

/** default visibility quick-save used by mobile toolbar commands */
export function quickVisibility(s: SGState): Visibility {
  return s.settings.defaultVisibility === "local" ? "local" : "private";
}
