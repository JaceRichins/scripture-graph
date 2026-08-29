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
import { Menu, Modal, Notice, Platform, Setting, type Plugin } from "obsidian";
import { chapterTitle, parseVerseId, verseDisplay, type Visibility } from "@scripture-graph/core-sdk";
import type { SGState } from "../state";
import { AnnotationService, COLORS, COLOR_HEX, NoteModal, NotesPopover } from "../social/annotations";
import { THEME_LIBRARY, themeSpec, type ThemeSpec } from "./themeLibrary";
import { trace } from "./trace";
import type { StudyService } from "./study";

/** Open Obsidian's local connections graph centered on a page (§graph).
 * The whole vault is wikilink-wired by the engine, so a chapter's local
 * graph pulls in its study guide, topics, people, evidence, other chapters,
 * podcast episodes, and the user's own notes. */
export async function openLocalGraphFor(s: SGState, linkText: string | null): Promise<void> {
  if (!linkText) return void new Notice("Nothing to graph here yet");
  const f = s.app.metadataCache.getFirstLinkpathDest(linkText, "");
  if (!f) return void new Notice(`Can't find “${linkText}”`);
  const ws = s.app.workspace as unknown as {
    getLeaf: (mode: unknown) => {
      setViewState: (st: unknown) => Promise<void>;
      view?: { containerEl?: HTMLElement };
      detach?: () => void;
    };
    getMostRecentLeaf?: () => unknown;
    revealLeaf: (l: unknown) => Promise<void>;
    setActiveLeaf?: (l: unknown, o?: unknown) => void;
  };
  const returnLeaf = ws.getMostRecentLeaf?.() ?? null;
  // desktop: side-by-side so the reading stays visible; mobile: new tab
  const leaf = ws.getLeaf(Platform.isMobile ? "tab" : "split");
  const GRAPH_OPTS = {
    textFadeMultiplier: 3, nodeSizeMultiplier: 1.4, lineSizeMultiplier: 1,
    showArrow: false, localJumps: 1, localBacklinks: true,
    localForelinks: true, localInterlinks: true,
    showTags: false, showAttachments: false, hideUnresolved: true,
    // settings panel arrives CLOSED and its sections collapsed
    close: true, "collapse-filter": true, "collapse-color-groups": true,
    "collapse-display": true, "collapse-forces": true,
  };
  await leaf.setViewState({
    type: "localgraph", active: true,
    state: { file: f.path, options: GRAPH_OPTS },
  });
  await ws.revealLeaf(leaf);
  // the state payload alone doesn't always take (observed on mobile): push
  // the options straight into the graph engine once it exists, with retries
  const pushOptions = () => {
    const view = leaf.view as unknown as {
      dataEngine?: { setOptions?: (o: unknown) => void };
      engine?: { setOptions?: (o: unknown) => void };
    } | undefined;
    const engine = view?.dataEngine ?? view?.engine;
    if (engine?.setOptions) {
      engine.setOptions(GRAPH_OPTS);
      trace("graph.optionsPushed", {});
      return true;
    }
    return false;
  };
  if (!pushOptions()) {
    window.setTimeout(pushOptions, 250);
    window.setTimeout(pushOptions, 800);
    window.setTimeout(pushOptions, 1800);
  }
  // mobile: a floating "← back" pill returns exactly to the reading spot
  if (Platform.isMobile && returnLeaf) {
    const container = leaf.view?.containerEl;
    if (container) {
      const back = container.createDiv({ cls: "sg-graph-back", text: `← ${linkText}` });
      back.onclick = () => {
        leaf.detach?.();
        ws.setActiveLeaf?.(returnLeaf, { focus: true });
      };
    }
  }
  trace("graph.open", { file: f.path });
}

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
  private lastSig = "";
  // touch-tap discrimination state (mobile)
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private downHadSelection = false;
  private lastScrollT = 0;
  private lastSelText = "";

  constructor(private s: SGState, private ann: AnnotationService,
    private study: StudyService,
    private openAsk: (seed: string, anchor: string | null) => void,
    private saveSettings: () => Promise<void> = async () => { /* harness */ }) {}

  // ------------------------------------------------------------ tap wiring

  /** Input wiring, modeled on Hypothesis's battle-tested selection observer:
   *  - the selection is captured shortly AFTER pointer-up (it isn't final at
   *    the event itself on iOS), and settles via a short debounce while
   *    handles are dragged — and it is NEVER cleared by us: the captured
   *    phrase lives in bar state, so actions work even after iOS collapses
   *    the native selection (e.g. when tapping a bar button).
   *  - a tap is only a tap when the finger didn't move, didn't linger,
   *    didn't land mid-scroll, and wasn't dismissing a selection. */
  private isPointerDown = false;

  attach(plugin: Plugin): void {
    plugin.registerDomEvent(document, "pointerdown", (evt: PointerEvent) => {
      this.isPointerDown = true;
      this.downX = evt.clientX;
      this.downY = evt.clientY;
      this.downT = Date.now();
      const native = window.getSelection();
      this.downHadSelection = !!native && !native.isCollapsed;
    }, { capture: true, passive: true } as AddEventListenerOptions);

    plugin.registerDomEvent(document, "pointercancel", () => {
      this.isPointerDown = false;
    }, { capture: true, passive: true } as AddEventListenerOptions);

    plugin.registerDomEvent(document, "pointerup", (evt: PointerEvent) => {
      this.isPointerDown = false;
      const dx = Math.abs(evt.clientX - this.downX);
      const dy = Math.abs(evt.clientY - this.downY);
      const dt = Date.now() - this.downT;
      const target = evt.target instanceof Element ? evt.target : null;
      // selection state is not final at pointerup — wait a tick (Hypothesis: 10ms)
      window.setTimeout(() => {
        const native = window.getSelection();
        const hasSel = !!native && !native.isCollapsed;
        if (hasSel) {
          trace("up.capture", { dt, len: native!.toString().length });
          this.capturePartial(native!);
          return;
        }
        if (this.downHadSelection) {
          // tap that dismissed a selection: dismiss our phrase bar too
          trace("up.dismissedSelection", { dt });
          if (this.sel.partial) this.clear();
          return;
        }
        if (!Platform.isMobile) return;                  // desktop taps use click
        if (dx > 10 || dy > 10) return trace("up.moved", { dx, dy });
        if (dt > 500) return trace("up.longpress", { dt });
        if (Date.now() - this.lastScrollT < 250) return trace("up.midscroll", {});
        trace("up.tap", { dt });
        this.handleTap({ target } as unknown as MouseEvent);
      }, 30);
    });

    plugin.registerDomEvent(document, "scroll", () => {
      this.lastScrollT = Date.now();
    }, { capture: true, passive: true } as AddEventListenerOptions);

    if (!Platform.isMobile) {
      plugin.registerDomEvent(document, "click", (evt) => this.handleTap(evt));
    }
    plugin.registerDomEvent(document, "selectionchange", () => this.handleSelectionChange());
  }

  /** Delegated tap handling for any container that renders verses. */
  handleTap(evt: MouseEvent | PointerEvent): void {
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
    // selection lives on the VERSE NUMBER — tapping the text just reads
    // (or dismisses an active selection); long-press still picks phrases
    const onNumber = !!target.closest("strong");
    if (!onNumber) {
      trace("tap.verseText", { vid });
      if (this.sel.verses.length || this.sel.partial) this.clear();
      return;
    }
    this.toggleVerse(vid, p);
  }

  /** selectionchange path (Hypothesis timing): ignored while the pointer is
   * down (pointer-up captures those); otherwise a 100ms settle captures
   * keyboard/handle-adjusted selections. A COLLAPSED selection never clears
   * the bar — the captured phrase is our state, and iOS collapses the native
   * selection for all sorts of reasons (including tapping our own buttons). */
  handleSelectionChange(): void {
    if (this.selTimer) window.clearTimeout(this.selTimer);
    this.selTimer = window.setTimeout(() => {
      if (this.isPointerDown) return;    // will be captured on pointer-up
      const native = window.getSelection();
      const text = native && !native.isCollapsed ? native.toString().trim() : "";
      if (!text) return;                 // collapse ≠ dismiss (state is captured)
      if (this.sel.partial?.selected === text) return;
      trace("selchange.capture", { len: text.length });
      this.capturePartial(native!);
    }, 100);
  }

  /** Native selection → partial-phrase state (selection left untouched). */
  private capturePartial(native: Selection): void {
    const text = native.toString().trim();
    if (text.length < 3 || text.length > 600) return;
    const anchor = native.anchorNode instanceof Element
      ? native.anchorNode : native.anchorNode?.parentElement;
    if (!anchor || anchor.closest(".cm-editor")) return;
    const p = anchor.closest("[data-verse-id], p");
    const vid = this.verseIdOf(p);
    if (!vid) {
      trace("capture.noVerse", {});
      return;
    }
    if (this.sel.partial?.selected === text
      && this.sel.partial.verseId === vid) return;
    trace("capture.partial", { vid, len: text.length });
    this.setPartial(vid, this.verseTextOf(p as HTMLElement), text);
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

  /** Verse text WITHOUT our decoration glyphs (📝/🃏/👥 icons would otherwise
   * leak into copies, note quotes, and card-dedup comparisons). */
  private verseTextOf(p: HTMLElement): string {
    const clone = p.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".sgh-note-icon, .sg-badge").forEach(e => e.remove());
    return (clone.textContent ?? "").replace(/^\s*\d+\s*/, "").trim();
  }

  // ------------------------------------------------------- selection state

  private toggleVerse(verseId: string, el: HTMLElement): void {
    trace("verse.toggle", { verseId });
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
    // the native selection is deliberately left alone (Hypothesis pattern):
    // the user keeps their visual anchor, and our captured state means
    // actions work even after iOS collapses it
  }

  clear(): void {
    trace("bar.clear", { hadPartial: !!this.sel.partial, verses: this.sel.verses.length });
    // leaving phrase mode is the right moment to let go of the native selection
    if (this.sel.partial) window.getSelection()?.removeAllRanges();
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
    document.body.toggleClass("sg-selecting", this.active);
    if (!this.active) {
      this.barEl?.remove();
      this.barEl = null;
      this.lastSig = "";
      return;
    }
    const scope = this.s.device.lastShareScope;
    const sig = JSON.stringify([this.sel.verses.map(v => v.verseId),
      this.sel.partial?.selected, scope, this.s.device.lastColor,
      this.s.device.lastStyle, this.s.device.lastTheme,
      (this.s.settings.themes ?? []).length]);
    if (sig === this.lastSig && this.barEl) return;      // no DOM churn
    this.lastSig = sig;
    if (!this.barEl) {
      this.barEl = document.body.createDiv({ cls: "sg-studybar" });
    }
    const bar = this.barEl;
    bar.empty();

    // row 1: reference + scope chip + close
    const top = bar.createDiv({ cls: "sg-studybar-top" });
    top.createSpan({ cls: "sg-studybar-ref", text: this.refLabel() });
    const scopeChip = top.createEl("button", {
      cls: "sg-scope-chip",
      text: scope.visibility === "group"
        ? `👥 ${this.s.groups.find(g => g.group_id === scope.groupId)?.name ?? "Group"}`
        : SCOPE_LABEL[scope.visibility] ?? "🔐 Only me",
    });
    scopeChip.onclick = (e) => this.pickScope(e);
    const close = top.createEl("button", { cls: "sg-studybar-x", text: "✕" });
    close.onclick = () => this.clear();

    // row 2: color dots + text-treatment chips — ONE TAP marks with the
    // remembered scope/style. Colors are inline so they never render gray.
    const colors = bar.createDiv({ cls: "sg-studybar-colors" });
    for (const c of COLORS) {
      const dot = colors.createEl("button", { cls: `sg-dot sg-dot-${c}` });
      dot.style.backgroundColor = COLOR_HEX[c] ?? "#f5d90a";
      if (c === this.s.device.lastColor) {
        dot.addClass("sg-dot-last");
        dot.style.borderColor = "var(--text-normal)";
      }
      dot.setAttribute("aria-label", `Mark ${c}`);
      dot.onclick = () => void this.doHighlight(c);
    }
    const styleRow = bar.createDiv({ cls: "sg-studybar-styles" });
    const styles: [string, string][] = [["highlight", "🖍"], ["underline", "U̲"],
      ["bold", "B"], ["italic", "I"]];
    for (const [key, label] of styles) {
      const chip = styleRow.createEl("button", { cls: "sg-style-chip", text: label });
      if (key === "bold") chip.style.fontWeight = "800";
      if (key === "italic") chip.style.fontStyle = "italic";
      if (key === (this.s.device.lastStyle || "highlight")) chip.addClass("sg-style-on");
      chip.setAttribute("aria-label", `${key} style`);
      chip.onclick = () => {
        this.s.device.lastStyle = key;
        this.s.device.lastTheme = null;   // manual pick leaves the theme
        void this.s.saveDevice();
        this.render();
      };
    }

    // row 2b: the THEME LIBRARY — premade study themes (gradient + emoji) plus
    // any family-created ones. Whole-verse, stackable; tap = tag, tap again =
    // untag. Chips the current verse already carries get a glow ring.
    const trow = bar.createDiv({ cls: "sg-studybar-themes" });
    const customs = (this.s.settings.themes ?? [])
      .filter(t => !THEME_LIBRARY.some(l => l.name.toLowerCase() === t.name.toLowerCase()))
      .map(t => themeSpec(t.name, this.s.settings.themes ?? [], COLOR_HEX));
    const chipByName = new Map<string, HTMLElement>();
    for (const sp of [...THEME_LIBRARY, ...customs]) {
      const chip = trow.createEl("button", {
        cls: "sg-theme-chip", text: `${sp.emoji} ${sp.name}`,
      });
      chip.style.borderBottom = `3px solid ${sp.c1}`;
      chipByName.set(sp.name.toLowerCase(), chip);
      chip.onclick = () => void this.doTheme(sp);
    }
    const add = trow.createEl("button", { cls: "sg-theme-chip sg-theme-add", text: "＋ own" });
    add.onclick = () => this.saveThemePrompt();
    void this.markActiveThemeChips(chipByName);

    // row 3: actions
    const row = bar.createDiv({ cls: "sg-studybar-actions" });
    const act = (label: string, fn: () => void) => {
      const b = row.createEl("button", { text: label });
      b.onclick = fn;
    };
    act("📝 Note", () => this.doNote());
    act("🃏 Card", () => void this.doFlashcard());
    act("🕸 Graph", () => void this.openGraph());
    act("📋 Copy", () => void this.doCopy());
    act("✨ AI", () => this.doAsk());
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
    const style = this.s.device.lastStyle ?? "highlight";
    this.s.device.lastColor = color;
    void this.s.saveDevice();
    if (this.sel.partial) {
      const p = this.sel.partial;
      await this.ann.addHighlight(p.verseId, color, p.verseText, p.selected,
        visibility, groupId, style, null);
    } else {
      for (const v of this.sel.verses) {
        await this.ann.addHighlight(v.verseId, color, v.verseText, null,
          visibility, groupId, style, null);
      }
    }
    new Notice(`Marked ${this.refLabel()}`);
    this.clear();   // the annotation service re-renders the reading views
  }

  /** connections graph for the selected verse's chapter */
  private async openGraph(): Promise<void> {
    const vid = this.targetVerseIds()[0];
    if (!vid) return;
    const r = parseVerseId(vid);
    const title = r ? chapterTitle(r.bookSlug, r.chapter) : null;
    this.clear();
    await openLocalGraphFor(this.s, title);
  }

  /** verses this action targets — themes are WHOLE-VERSE by design, so a
   * phrase selection resolves to its verse */
  private targetVerseIds(): string[] {
    if (this.sel.partial) return [this.sel.partial.verseId];
    return this.sel.verses.map(v => v.verseId);
  }

  /** apply/remove a theme tag on every selected verse (stackable) */
  private async doTheme(spec: ThemeSpec): Promise<void> {
    const { visibility, groupId } = this.s.device.lastShareScope;
    const ids = this.targetVerseIds();
    if (!ids.length) return;
    let added = 0, removed = 0;
    for (const vid of ids) {
      const on = await this.ann.toggleTheme(vid, spec.name, spec.c1, visibility, groupId);
      if (on) added++; else removed++;
    }
    trace("theme.toggle", { theme: spec.name, added, removed });
    new Notice(added && !removed ? `${spec.emoji} ${spec.name} — ${this.refLabel()}`
      : !added && removed ? `${spec.emoji} ${spec.name} removed`
        : `${spec.emoji} ${spec.name} updated`);
    this.clear();
  }

  /** ring the chips whose theme the (first) selected verse already carries */
  private async markActiveThemeChips(chips: Map<string, HTMLElement>): Promise<void> {
    const vid = this.targetVerseIds()[0];
    if (!vid) return;
    const mine = await this.ann.mine(vid);
    for (const a of mine) {
      if (a.annotation_type === "highlight" && a.theme && !a.selected_text) {
        chips.get(a.theme.toLowerCase())?.addClass("sg-style-on");
      }
    }
  }

  /** name the current color+treatment as a shared family theme */
  private saveThemePrompt(): void {
    const color = this.s.device.lastColor;
    const style = this.s.device.lastStyle || "highlight";
    new ThemeNameModal(this.s, color, async (name) => {
      const themes = this.s.settings.themes ?? [];
      const existing = themes.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
      const entry = { name, color, style };
      if (existing >= 0) themes[existing] = entry;
      else themes.push(entry);
      this.s.applySettings({ themes });
      await this.saveSettings();
      new Notice(`Theme “${name}” added to the family library`);
      this.lastSig = "";   // force chip-row rebuild
      this.render();
    }).open();
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
}

class ThemeNameModal extends Modal {
  constructor(s: SGState, private desc: string,
    private onSave: (name: string) => void) {
    super(s.app);
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Name this theme" });
    this.contentEl.createEl("p", {
      text: `Current look: ${this.desc}. Themes are shared with the family — `
        + `e.g. "Faith", "Covenants", "Promises".`,
    });
    let name = "";
    new Setting(this.contentEl).setName("Theme name").addText(t =>
      t.setPlaceholder("Faith").onChange(v => (name = v)));
    new Setting(this.contentEl).addButton(b => b.setButtonText("Save theme").setCta()
      .onClick(() => {
        const n = name.trim().slice(0, 40);
        if (!n) return;
        this.close();
        this.onSave(n);
      }));
  }
  onClose() { this.contentEl.empty(); }

}
