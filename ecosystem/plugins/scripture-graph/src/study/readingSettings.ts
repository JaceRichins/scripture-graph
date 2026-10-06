/** Aa Reading settings — one sheet, one tap, for the things a reader
 * changes: text size, line spacing, typeface, page width, reading page,
 * focus mode, notes beside verses, the scene, the dock. Applied as CSS
 * variables and body classes so every reading surface (canonical chapters,
 * My Notes, question/talk/history pages, the reader) follows; remembered on
 * this device. The assistant changes the same settings through
 * saveReading(), the one path every control uses. Every new setting's
 * default is the look the app already had, so nothing moves until asked. */
import { Modal } from "obsidian";
import { SGState } from "../state";

export interface ReadingPrefs {
  scale: number;          // 0.9 … 1.4
  spacing: number;        // 1.45 … 1.9
  font: "sans" | "serif" | "book";
  width: "normal" | "wide";
  /** the page behind the words: "scene" = the app as it was (the reading
   * scene shows through); paper, sepia and night put a solid page there */
  theme: "scene" | "paper" | "sepia" | "night";
  /** focus reading: the words only; every bar and strip steps aside */
  focus: boolean;
  /** my notes shown beneath the verse they belong to, not only behind the 📝 */
  marginNotes: boolean;
  /** whether the assistant may change these for me when I ask it to */
  aiControls: boolean;
  /** the glass design across the app; false = the classic flat look, exactly as it was */
  glass: boolean;
  /** within Glass: the one app-wide type scale (a matter of taste, so its own switch) */
  glassType: boolean;
  /** within Glass: fewer borders and dividers (likewise its own switch) */
  glassCalm: boolean;
  /** within Glass: secondary controls wait behind each surface's ⋯ menu */
  glassMenus: boolean;
}

export const DEFAULT_READING: ReadingPrefs = { scale: 1, spacing: 1.6, font: "sans", width: "normal",
  theme: "scene", focus: false, marginNotes: true, aiControls: true,
  glass: true, glassType: true, glassCalm: true, glassMenus: true };

export const READING_THEMES = ["scene", "paper", "sepia", "night"] as const;
export const READING_FONTS = ["sans", "serif", "book"] as const;
/** the ranges any caller (the sheet, the assistant) is held to */
export const SCALE_RANGE = [0.8, 1.6] as const;
export const SPACING_RANGE = [1.3, 2.1] as const;
const FONT_STACK: Record<ReadingPrefs["font"], string> = {
  sans: "var(--font-text)",
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
  book: '"Charter", "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
};

export function readingPrefs(s: SGState): ReadingPrefs {
  const d = s.device as { reading?: Partial<ReadingPrefs> };
  return { ...DEFAULT_READING, ...(d.reading ?? {}) };
}

/** push the prefs into CSS variables — call at load and on every change */
export function applyReading(s: SGState): void {
  const p = readingPrefs(s);
  const st = document.body.style;
  st.setProperty("--sg-read-scale", String(p.scale));
  st.setProperty("--sg-read-spacing", String(p.spacing));
  st.setProperty("--sg-read-font", FONT_STACK[p.font] ?? FONT_STACK.sans);
  document.body.toggleClass("sg-read-wide", p.width === "wide");
  // "serif" here means "the reading face is not the app's own"; book uses it too
  document.body.toggleClass("sg-read-serif", p.font === "serif" || p.font === "book");
  // Each class appears only when its setting leaves the default, so a page at
  // defaults carries exactly the classes it did before these settings existed.
  for (const t of READING_THEMES) if (t !== "scene") document.body.toggleClass(`sg-read-theme-${t}`, p.theme === t);
  document.body.toggleClass("sg-read-focus", p.focus);
  document.body.toggleClass("sg-read-notes-off", !p.marginNotes);
  // One class switches the whole glass layer on or off; nothing else changes.
  document.body.toggleClass("sg-glass", p.glass);
  // The two subjective parts of it, each vetoable on its own.
  document.body.toggleClass("sg-glass-type", p.glass && p.glassType);
  document.body.toggleClass("sg-glass-calm", p.glass && p.glassCalm);
  document.body.toggleClass("sg-glass-menus", p.glass && p.glassMenus);
}

/** Tidy menus on? Surfaces ask at the moment they build a menu, so switching
 * it off restores the always-visible controls on the next open, exactly. */
export function tidyMenus(): boolean {
  return document.body.classList.contains("sg-glass-menus");
}

/** The one way any control changes a reading setting: numbers are held to
 * their ranges and choices to their lists, saved on this device, applied at
 * once. Returns the settings as saved. */
export function saveReading(s: SGState, patch: Partial<ReadingPrefs>): ReadingPrefs {
  const cur = readingPrefs(s);
  const clamp = (v: unknown, [lo, hi]: readonly [number, number], fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 100) / 100)) : fallback;
  const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => list.includes(v as T) ? v as T : fallback;
  const next: ReadingPrefs = {
    ...cur, ...patch,
    scale: clamp(patch.scale ?? cur.scale, SCALE_RANGE, cur.scale),
    spacing: clamp(patch.spacing ?? cur.spacing, SPACING_RANGE, cur.spacing),
    font: pick(patch.font ?? cur.font, READING_FONTS, cur.font),
    width: pick(patch.width ?? cur.width, ["normal", "wide"] as const, cur.width),
    theme: pick(patch.theme ?? cur.theme, READING_THEMES, cur.theme),
  };
  for (const k of ["focus", "marginNotes", "aiControls", "glass", "glassType", "glassCalm", "glassMenus"] as const) {
    if (typeof next[k] !== "boolean") next[k] = cur[k];
  }
  (s.device as { reading?: Partial<ReadingPrefs> }).reading = next;
  void s.saveDevice();
  applyReading(s);
  return next;
}

/** What the assistant is told about these settings so it can change them.
 * Absent when the reader has switched assistant control off: the server then
 * never offers the actions, and Chat is exactly what it was. */
export function readingSnapshot(s: SGState): Record<string, unknown> | undefined {
  const p = readingPrefs(s);
  if (!p.aiControls) return undefined;
  return { size: p.scale, spacing: p.spacing, typeface: p.font, theme: p.theme, focus: p.focus, width: p.width,
    marginNotes: p.marginNotes, sizes: SCALE_RANGE, spacings: SPACING_RANGE, themes: READING_THEMES, typefaces: READING_FONTS };
}

export class ReadingSettingsModal extends Modal {
  constructor(private s: SGState, private openScene: () => void, private toggleDock: () => void) {
    super(s.app);
  }

  private save(patch: Partial<ReadingPrefs>): void {
    saveReading(this.s, patch);
    this.render();
  }

  onOpen(): void {
    this.modalEl.addClass("sg-lib-modal");
    this.contentEl.addClass("sg-rs");
    this.render();
  }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    const p = readingPrefs(this.s);
    c.createEl("h2", { cls: "sg-rs-title", text: "Reading" });
    const seg = (label: string, opts: { k: string; t: string; on: boolean; go: () => void }[]) => {
      c.createDiv({ cls: "sg-rs-label", text: label });
      const row = c.createDiv({ cls: "sg-rs-seg" });
      for (const o of opts) {
        const b = row.createEl("button", { cls: `sg-rs-btn${o.on ? " sg-rs-on" : ""}`, text: o.t });
        b.onclick = o.go;
      }
    };
    seg("Text size", [0.9, 1, 1.15, 1.3, 1.45].map((v, i) => ({
      k: String(v), t: ["S", "M", "L", "XL", "XXL"][i]!, on: Math.abs(p.scale - v) < 0.01,
      go: () => this.save({ scale: v }) })));
    seg("Line spacing", [[1.45, "Tight"], [1.6, "Normal"], [1.8, "Roomy"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: Math.abs(p.spacing - Number(v)) < 0.01,
      go: () => this.save({ spacing: Number(v) }) })));
    seg("Typeface", [["sans", "Sans"], ["serif", "Serif"], ["book", "Book"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.font === v, go: () => this.save({ font: v as ReadingPrefs["font"] }) })));
    seg("Page width", [["normal", "Normal"], ["wide", "Wide"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.width === v, go: () => this.save({ width: v as "normal" | "wide" }) })));
    seg("Page", [["scene", "Scene"], ["paper", "Paper"], ["sepia", "Sepia"], ["night", "Night"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.theme === v, go: () => this.save({ theme: v as ReadingPrefs["theme"] }) })));
    seg("Notes beside verses", [[true, "Show"], [false, "Hide"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.marginNotes === v, go: () => this.save({ marginNotes: v as boolean }) })));
    seg("Assistant can change these", [[true, "Yes"], [false, "No"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.aiControls === v, go: () => this.save({ aiControls: v as boolean }) })));
    seg("Style", [[true, "Glass"], [false, "Classic"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.glass === v, go: () => this.save({ glass: v as boolean }) })));
    if (p.glass) {
      seg("Refined type", [[true, "On"], [false, "Off"]].map(([v, t]) => ({
        k: String(v), t: String(t), on: p.glassType === v, go: () => this.save({ glassType: v as boolean }) })));
      seg("Less chrome", [[true, "On"], [false, "Off"]].map(([v, t]) => ({
        k: String(v), t: String(t), on: p.glassCalm === v, go: () => this.save({ glassCalm: v as boolean }) })));
      seg("Tidy menus", [[true, "On"], [false, "Off"]].map(([v, t]) => ({
        k: String(v), t: String(t), on: p.glassMenus === v, go: () => this.save({ glassMenus: v as boolean }) })));
    }
    const row = c.createDiv({ cls: "sg-rs-actions" });
    const focus = row.createEl("button", { cls: "sg-rs-act", text: p.focus ? "◎ Leave focus reading" : "◎ Focus reading" });
    focus.onclick = () => { const on = !p.focus; saveReading(this.s, { focus: on }); if (on) this.close(); else this.render(); };
    const scene = row.createEl("button", { cls: "sg-rs-act", text: "🌄 Reading scene" });
    scene.onclick = () => { this.close(); this.openScene(); };
    const dock = row.createEl("button", { cls: "sg-rs-act",
      text: this.s.device.dock === false ? "⌂ Show the dock" : "⌂ Hide the dock" });
    dock.onclick = () => { this.toggleDock(); this.render(); };
    const sample = c.createDiv({ cls: "sg-rs-sample markdown-preview-view" });
    sample.createEl("p", { text: "And it came to pass that I, Nephi, said unto my father: I will go and do the things which the Lord hath commanded." });
  }

  onClose(): void { this.contentEl.empty(); }
}
