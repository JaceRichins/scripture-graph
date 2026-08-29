/** The study surface: Gospel-Library-style verse selection + bottom action bar.
 *
 * Interaction model (mobile-first, works everywhere):
 *  - TAP a verse        → toggles its selection (dotted underline), bar appears
 *  - tap more verses    → multi-verse selection
 *  - long-press-select  → partial-text mode for that phrase (takes precedence)
 *  - tap a highlight    → opens that verse's notes popover
 *  - tap elsewhere      → clears selection, bar hides
 *  - color dot on bar   → highlight INSTANTLY with the remembered share scope
 *  - scope chip on bar  → change who sees it (remembered per device)
 *
 * Nothing here ever blocks link taps or native text selection.
 */
import { Menu, Notice, Platform } from "obsidian";
import { parseVerseId, verseDisplay, type Visibility } from "@scripture-graph/core-sdk";
import type { SGState } from "../state";
import { AnnotationService, COLORS, NoteModal, NotesPopover } from "../social/annotations";
import type { StudyService } from "./study";

export interface StudySelection {
  /** ordered verse ids currently selected (whole-verse mode) */
  verses: { verseId: string; verseText: string; el: HTMLElement }[];
  /** partial-text mode: a phrase inside one verse */
  partial: { verseId: string; verseText: string; selected: string } | null;
}

const SCOPE_LABEL: Record<string, string> = {
  local: "🔒 This device", private: "🔐 Only me", group: "👥", public: "🌎 Public",
};

export class StudyBar {
  private sel: StudySelection = { verses: [], partial: null };
  private barEl: HTMLElement | null = null;
  private selTimer: number | null = null;

  constructor(private s: SGState, private ann: AnnotationService,
    private study: StudyService,
    private openAsk: (seed: string, anchor: string | null) => void) {}

  // ------------------------------------------------------------ tap wiring

  /** Delegated tap handling for any container that renders verses. */
  handleTap(evt: MouseEvent): void {
    const target = evt.target instanceof Element ? evt.target : null;
    if (!target) return;
    if (target.closest(".sg-studybar, .modal, .menu, .prompt")) return;
    // links, buttons, inputs behave normally — never intercepted
    if (target.closest("a, button, input, textarea, select")) return;
    if (target.closest(".cm-editor")) return;              // editors are editors
    // existing marks/icons open the verse popover (Gospel Library parity)
    const mark = target.closest("mark.sgh, .sgh-note-icon, .sg-badge");
    if (mark) {
      const p = mark.closest("[data-verse-id], p");
      const vid = this.verseIdOf(p);
      if (vid) {
        new NotesPopover(this.s, this.ann, vid).open();
        return;
      }
    }
    // real text selection in progress? selectionchange handles it
    const native = window.getSelection();
    if (native && !native.isCollapsed) return;

    const p = target.closest("[data-verse-id], p");
    const vid = this.verseIdOf(p);
    if (!vid || !(p instanceof HTMLElement)) {
      if (this.sel.verses.length || this.sel.partial) this.clear();
      return;
    }
    this.toggleVerse(vid, p);
  }

  /** Long-press / drag text selection → partial mode (debounced). */
  handleSelectionChange(): void {
    if (this.selTimer) window.clearTimeout(this.selTimer);
    this.selTimer = window.setTimeout(() => {
      const native = window.getSelection();
      if (!native || native.isCollapsed) return;
      const anchor = native.anchorNode instanceof Element
        ? native.anchorNode : native.anchorNode?.parentElement;
      if (!anchor || anchor.closest(".cm-editor")) return;
      const p = anchor.closest("[data-verse-id], p");
      const vid = this.verseIdOf(p);
      if (!vid) return;
      const text = native.toString().trim();
      if (text.length < 3 || text.length > 600) return;
      this.setPartial(vid, this.verseTextOf(p as HTMLElement), text);
    }, 300);
  }

  private verseIdOf(el: Element | null): string | null {
    if (!el) return null;
    const direct = (el as HTMLElement).getAttribute?.("data-verse-id")
      ?? (el.closest("[data-verse-id]") as HTMLElement | null)?.getAttribute("data-verse-id");
    if (direct && parseVerseId(direct)) return direct;
    // reading view: verse paragraphs start with a bold number; slug from context
    if (!(el instanceof HTMLElement) || el.tagName !== "P") return null;
    const strong = el.querySelector("strong");
    const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
    if (!Number.isFinite(n)) return null;
    const slug = this.slugForContainer(el);
    return slug && parseVerseId(`${slug}-${n}`) ? `${slug}-${n}` : null;
  }

  private slugForContainer(el: HTMLElement): string | null {
    const embed = el.closest(".internal-embed[src]");
    const src = embed?.getAttribute("src") ?? null;
    if (src?.includes("#^")) return null; // single-verse embeds handled by data attr
    const app = this.s.app;
    if (src) {
      const dest = app.metadataCache.getFirstLinkpathDest(src.split("#")[0]!, "");
      if (!dest) return null;
      return (app.metadataCache.getFileCache(dest)?.frontmatter as { slug?: string })
        ?.slug ?? null;
    }
    const f = app.workspace.getActiveFile();
    if (!f) return null;
    return (app.metadataCache.getFileCache(f)?.frontmatter as { slug?: string })
      ?.slug ?? null;
  }

  private verseTextOf(p: HTMLElement): string {
    return (p.textContent ?? "").replace(/^\s*\d+\s*/, "").trim();
  }

  // ------------------------------------------------------- selection state

  private toggleVerse(verseId: string, el: HTMLElement): void {
    this.sel.partial = null;
    const i = this.sel.verses.findIndex(v => v.verseId === verseId);
    if (i >= 0) {
      this.sel.verses[i]!.el.removeClass("sg-vsel");
      this.sel.verses.splice(i, 1);
    } else {
      el.addClass("sg-vsel");
      this.sel.verses.push({ verseId, verseText: this.verseTextOf(el), el });
      this.sel.verses.sort((a, b) => {
        const A = parseVerseId(a.verseId)!, B = parseVerseId(b.verseId)!;
        return A.chapter - B.chapter || A.verse - B.verse;
      });
    }
    this.render();
  }

  private setPartial(verseId: string, verseText: string, selected: string): void {
    for (const v of this.sel.verses) v.el.removeClass("sg-vsel");
    this.sel.verses = [];
    this.sel.partial = { verseId, verseText, selected };
    this.render();
  }

  clear(): void {
    for (const v of this.sel.verses) v.el.removeClass("sg-vsel");
    this.sel = { verses: [], partial: null };
    this.render();
  }

  private get active(): boolean {
    return this.sel.verses.length > 0 || this.sel.partial !== null;
  }

  private refLabel(): string {
    if (this.sel.partial) return verseDisplay(this.sel.partial.verseId) ?? this.sel.partial.verseId;
    const vs = this.sel.verses;
    if (!vs.length) return "";
    const first = verseDisplay(vs[0]!.verseId) ?? vs[0]!.verseId;
    if (vs.length === 1) return first;
    const last = parseVerseId(vs[vs.length - 1]!.verseId)!;
    return `${first}–${last.verse}`;
  }

  // ------------------------------------------------------------ action bar

  private render(): void {
    if (!this.active) {
      this.barEl?.remove();
      this.barEl = null;
      return;
    }
    if (!this.barEl) {
      this.barEl = document.body.createDiv({ cls: "sg-studybar" });
    }
    const bar = this.barEl;
    bar.empty();

    // row 1: reference + scope chip + close
    const top = bar.createDiv({ cls: "sg-studybar-top" });
    top.createSpan({ cls: "sg-studybar-ref", text: this.refLabel() });
    const scope = this.s.device.lastShareScope;
    const scopeChip = top.createEl("button", {
      cls: "sg-scope-chip",
      text: scope.visibility === "group"
        ? `👥 ${this.s.groups.find(g => g.group_id === scope.groupId)?.name ?? "Group"}`
        : SCOPE_LABEL[scope.visibility] ?? "🔐 Only me",
    });
    scopeChip.onclick = (e) => this.pickScope(e);
    const close = top.createEl("button", { cls: "sg-studybar-x", text: "✕" });
    close.onclick = () => this.clear();

    // row 2: color dots — ONE TAP highlights with the remembered scope
    const colors = bar.createDiv({ cls: "sg-studybar-colors" });
    for (const c of COLORS) {
      const dot = colors.createEl("button", { cls: `sg-dot sg-dot-${c}` });
      if (c === this.s.device.lastColor) dot.addClass("sg-dot-last");
      dot.setAttribute("aria-label", `Highlight ${c}`);
      dot.onclick = () => void this.doHighlight(c);
    }

    // row 3: actions
    const row = bar.createDiv({ cls: "sg-studybar-actions" });
    const act = (label: string, fn: () => void) => {
      const b = row.createEl("button", { text: label });
      b.onclick = fn;
    };
    act("📝 Note", () => this.doNote());
    act("🃏 Card", () => void this.doFlashcard());
    act("📋 Copy", () => void this.doCopy());
    act("✨ Ask AI", () => this.doAsk());
  }

  private pickScope(e: MouseEvent): void {
    const menu = new Menu();
    const set = (visibility: Visibility, groupId: string | null, label: string) => {
      this.s.device.lastShareScope = { visibility, groupId };
      void this.s.saveDevice();
      new Notice(`New marks: ${label}`);
      this.render();
    };
    menu.addItem(i => i.setTitle("🔐 Only me (synced)")
      .onClick(() => set("private", null, "only you")));
    menu.addItem(i => i.setTitle("🔒 Only me (this device)")
      .onClick(() => set("local", null, "this device only")));
    for (const g of this.s.groups) {
      menu.addItem(i => i.setTitle(`👥 ${g.name}`)
        .onClick(() => set("group", g.group_id, g.name)));
    }
    menu.addItem(i => i.setTitle("🌎 Public")
      .onClick(() => set("public", null, "public")));
    menu.showAtMouseEvent(e);
  }

  private async doHighlight(color: string): Promise<void> {
    const { visibility, groupId } = this.s.device.lastShareScope;
    this.s.device.lastColor = color;
    void this.s.saveDevice();
    if (this.sel.partial) {
      const p = this.sel.partial;
      await this.ann.addHighlight(p.verseId, color, p.verseText, p.selected,
        visibility, groupId);
    } else {
      for (const v of this.sel.verses) {
        await this.ann.addHighlight(v.verseId, color, v.verseText, null,
          visibility, groupId);
      }
    }
    new Notice(`Highlighted ${this.refLabel()}`);
    this.clear();
    this.rerenderReading();
  }

  private doNote(): void {
    const ref = this.refLabel();
    const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId;
    const quoted = this.sel.partial?.selected ?? null;
    if (!anchor) return;
    const { visibility, groupId } = this.s.device.lastShareScope;
    new NoteModal(this.s, ref, (text) => {
      const body = this.sel.verses.length > 1 ? `(${ref}) ${text}` : text;
      void this.ann.addNote(anchor, body, quoted, visibility, groupId);
      new Notice(`Note saved — ${ref}`);
      this.clear();
    }).open();
  }

  private async doFlashcard(): Promise<void> {
    const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId;
    if (!anchor) return;
    const back = this.sel.partial?.selected
      ?? this.sel.verses.map(v => v.verseText).join(" ");
    const ref = this.refLabel();
    await this.study.addFlashcard(`What does ${ref} say?`, back.slice(0, 600), anchor);
    this.clear();
  }

  private async doCopy(): Promise<void> {
    const ref = this.refLabel();
    const text = this.sel.partial?.selected
      ?? this.sel.verses.map(v => v.verseText).join("\n");
    try {
      await navigator.clipboard.writeText(`"${text}"\n— ${ref}`);
      new Notice(`Copied ${ref}`);
    } catch {
      new Notice("Copy failed");
    }
    this.clear();
  }

  private doAsk(): void {
    const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId ?? null;
    const seed = this.sel.partial ? `About "${this.sel.partial.selected}" — ` : "";
    this.clear();
    this.openAsk(seed, anchor);
  }

  /** nudge open reading views to re-render decorations after a change */
  private rerenderReading(): void {
    this.s.notify();
    if (Platform.isMobile) return; // markdown post-processors re-run on their own
  }
}
