/** Aa Reading settings — one sheet, one tap, for the things a reader
 * changes: text size, line spacing, typeface, page width, the scene, the
 * dock. Applied as CSS variables on the body so every reading surface
 * (canonical chapters, My Notes, question/talk/history pages, the reader)
 * follows; remembered on this device. */
import { Modal } from "obsidian";
import { SGState } from "../state";

export interface ReadingPrefs {
  scale: number;          // 0.9 … 1.4
  spacing: number;        // 1.45 … 1.9
  font: "sans" | "serif";
  width: "normal" | "wide";
}

export const DEFAULT_READING: ReadingPrefs = { scale: 1, spacing: 1.6, font: "sans", width: "normal" };

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
  st.setProperty("--sg-read-font", p.font === "serif"
    ? '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'
    : "var(--font-text)");
  document.body.toggleClass("sg-read-wide", p.width === "wide");
  document.body.toggleClass("sg-read-serif", p.font === "serif");
}

export class ReadingSettingsModal extends Modal {
  constructor(private s: SGState, private openScene: () => void, private toggleDock: () => void) {
    super(s.app);
  }

  private save(patch: Partial<ReadingPrefs>): void {
    const d = this.s.device as { reading?: Partial<ReadingPrefs> };
    d.reading = { ...readingPrefs(this.s), ...patch };
    void this.s.saveDevice();
    applyReading(this.s);
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
    seg("Typeface", [["sans", "Sans"], ["serif", "Serif"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.font === v, go: () => this.save({ font: v as "sans" | "serif" }) })));
    seg("Page width", [["normal", "Normal"], ["wide", "Wide"]].map(([v, t]) => ({
      k: String(v), t: String(t), on: p.width === v, go: () => this.save({ width: v as "normal" | "wide" }) })));
    const row = c.createDiv({ cls: "sg-rs-actions" });
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
