/** In-place reading-view integration: decorate canonical files wherever they
 * render (plain view, Annotated view embeds, My Study embeds), and provide
 * the selection menu (highlight colors × visibility, note, ask AI). */
import { Menu, Notice, Platform, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { Visibility } from "@scripture-graph/core-sdk";
import { CANONICAL_PREFIX, SGState } from "../state";
import { AnnotationService, COLORS, NoteModal, NotesPopover, decorateVerse } from "./annotations";

export interface SelectionHit {
  verseId: string;
  verseText: string | null;
  selected: string | null;
}

export function registerReadingIntegration(
  plugin: Plugin, s: SGState, svc: AnnotationService,
  openAsk: (prompt: string, anchor: string | null) => void,
): void {
  // ---- decorations -------------------------------------------------------
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

  // ---- selection context menu (desktop right-click / long-press) ---------
  plugin.registerDomEvent(document, "contextmenu", (evt) => {
    const hit = resolveSelection(s, evt);
    if (!hit) return;
    evt.preventDefault();
    evt.stopPropagation();
    buildSelectionMenu(s, svc, hit, openAsk).showAtMouseEvent(evt);
  });

  // ---- mobile: TAP a verse = study actions (the LDS-Tools flow) ----------
  // Reading view is the default surface, so a tap should study, never type.
  // Links, buttons, and the note/badge icons keep their own behavior.
  if (Platform.isMobile) {
    plugin.registerDomEvent(document, "click", (evt) => {
      const target = evt.target instanceof Element ? evt.target : null;
      if (!target) return;
      if (target.closest("a, button, input, textarea, select, "
        + ".sgh-note-icon, .sg-badge, .modal, .menu")) return;
      const hit = resolveSelection(s, evt);
      if (!hit) return;
      evt.preventDefault();
      evt.stopPropagation();
      buildSelectionMenu(s, svc, hit, openAsk)
        .showAtPosition({ x: evt.clientX, y: evt.clientY });
    });
  }
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

  // reader view marks verses with data-verse-id; reading view uses embeds/strong
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
  const verseText = (p.textContent ?? "").replace(/^\s*\d+\s*/, "").trim() || null;
  return {
    verseId,
    verseText,
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
