/** 🕰 The Timeline — all of scripture history on one scrollable spine.
 *
 * Time flows DOWN (phone-first). Old World events hang left of the spine,
 * Book of Mormon events right, the Restoration full-width. Century rulers
 * break the stream and open their anchor pages as sheets. Filtering is the
 * soul of it: era jumps, region and category chips, a detail toggle
 * (major-only by default — no data floods), and a search box that doubles
 * as a person/place spotlight. Event links ride the one link ladder:
 * verses peek, chapters open your study page, people float as sheets. */
import { ItemView, TFile, WorkspaceLeaf, type App } from "obsidian";
import { SGState } from "../state";

export const TIMELINE_VIEW = "sg-timeline";

export interface TimelineEvent {
  id: string; t: string; y0: number; y1: number;
  lane: "ow" | "nw" | "rs";
  imp: 1 | 2 | 3;
  cat: string[];
  dating: string;
  people?: string[]; places?: string[]; chapters?: string[];
  note: string;
}

export interface TimelineData {
  version: number;
  events: TimelineEvent[];
  book_years: Record<string, number>;
}

const DATA_PATH = "AI Library/90 Timeline/_data.md";

const ERAS: { label: string; y: number }[] = [
  { label: "Beginnings", y: -4000 },
  { label: "Abraham", y: -2000 },
  { label: "Exodus", y: -1446 },
  { label: "Kings", y: -1050 },
  { label: "Lehi & Exile", y: -605 },
  { label: "Judges (BoM)", y: -130 },
  { label: "Christ", y: -6 },
  { label: "Apostles", y: 34 },
  { label: "Cumorah", y: 320 },
  { label: "Restoration", y: 1820 },
];

const CATS: { key: string; label: string }[] = [
  { key: "prophets", label: "🕊 Prophets" },
  { key: "visions", label: "✨ Visions" },
  { key: "wars", label: "⚔️ Wars" },
  { key: "rulers", label: "👑 Rulers" },
  { key: "journeys", label: "🧭 Journeys" },
  { key: "temples", label: "🏛 Temples" },
  { key: "records", label: "📜 Records" },
  { key: "turning", label: "🔑 Turning points" },
];

const DATING_SHORT: Record<string, string> = {
  traditional: "trad.", approximate: "approx.",
  internal: "BoM internal", historical: "historical",
};

function yearStr(y: number): string {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}

export async function loadTimelineData(app: App): Promise<TimelineData | null> {
  const file = app.vault.getAbstractFileByPath(DATA_PATH);
  if (!(file instanceof TFile)) return null;
  try {
    const md = await app.vault.cachedRead(file);
    const m = /```json\n([\s\S]*?)\n```/.exec(md);
    if (!m) return null;
    return JSON.parse(m[1]!) as TimelineData;
  } catch {
    return null;
  }
}

export class TimelineView extends ItemView {
  private data: TimelineData | null = null;
  private lanes = new Set(["ow", "nw", "rs"]);
  private cats = new Set(CATS.map(c => c.key));
  private detail = false;         // false = major+notable only
  private query = "";
  private pendingYear: number | null = null;
  private streamEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private s: SGState) { super(leaf); }

  getViewType(): string { return TIMELINE_VIEW; }
  getDisplayText(): string { return "Timeline"; }
  getIcon(): string { return "history"; }

  /** scroll to a year once rendered (era-tap from a reading page) */
  setYear(y: number): void {
    this.pendingYear = y;
    if (this.data) this.scrollToYear(y);
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("sg-tl");
    this.data = await loadTimelineData(this.s.app);
    this.render();
    // the dataset may land AFTER this view opens (engine build finishing,
    // or Obsidian Sync delivering) — notice its arrival and come alive
    const vault = this.s.app.vault;
    if (typeof (vault as unknown as { on?: unknown }).on === "function") {
      const arrived = (f: { path?: string }) => {
        if (this.data || f?.path !== DATA_PATH) return;
        void this.reload();
      };
      this.registerEvent(vault.on("create", arrived));
      this.registerEvent(vault.on("modify", arrived));
    }
  }

  private async reload(): Promise<void> {
    this.data = await loadTimelineData(this.s.app);
    this.render();
  }

  private visible(): TimelineEvent[] {
    if (!this.data) return [];
    const q = this.query.toLowerCase();
    return this.data.events.filter(e => {
      if (!this.lanes.has(e.lane)) return false;
      if (!this.detail && e.imp > 2) return false;
      if (!e.cat.some(c => this.cats.has(c))) return false;
      if (q) {
        const hay = [e.t, e.note, ...(e.people ?? []), ...(e.places ?? []),
          ...(e.chapters ?? [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.y0 - b.y0 || a.id.localeCompare(b.id));
  }

  private render(): void {
    const c = this.contentEl;
    c.empty();
    if (!this.data) {
      const empty = c.createDiv({ cls: "sg-tl-empty" });
      empty.createDiv({
        text: "Timeline data hasn't reached this device yet — it loads itself the moment it arrives.",
      });
      const retry = empty.createEl("button", { cls: "sg-tl-retry", text: "↻ Check now" });
      retry.onclick = () => void this.reload();
      return;
    }

    // ---- filter bar -----------------------------------------------------
    const bar = c.createDiv({ cls: "sg-tl-bar" });
    const eras = bar.createDiv({ cls: "sg-tl-eras" });
    for (const era of ERAS) {
      const b = eras.createEl("button", { cls: "sg-tl-era", text: era.label });
      b.onclick = () => this.scrollToYear(era.y);
    }
    const row2 = bar.createDiv({ cls: "sg-tl-row" });
    const laneDefs: [string, string][] = [["ow", "🌍 Old World"],
      ["nw", "🌎 Book of Mormon"], ["rs", "🌅 Restoration"]];
    for (const [key, label] of laneDefs) {
      const b = row2.createEl("button", { cls: "sg-tl-chip", text: label });
      b.toggleClass("sg-tl-on", this.lanes.has(key));
      b.onclick = () => {
        if (this.lanes.has(key)) this.lanes.delete(key); else this.lanes.add(key);
        this.render();
      };
    }
    const detail = row2.createEl("button", {
      cls: "sg-tl-chip sg-tl-detail",
      text: this.detail ? "🔎 All detail" : "⭐ Major events",
    });
    detail.toggleClass("sg-tl-on", true);
    detail.onclick = () => { this.detail = !this.detail; this.render(); };

    const row3 = bar.createDiv({ cls: "sg-tl-row sg-tl-cats" });
    for (const cat of CATS) {
      const b = row3.createEl("button", { cls: "sg-tl-chip", text: cat.label });
      b.toggleClass("sg-tl-on", this.cats.has(cat.key));
      b.onclick = () => {
        // tapping the ONLY active category restores all — a quick solo/reset
        if (this.cats.has(cat.key) && this.cats.size === 1) {
          this.cats = new Set(CATS.map(x => x.key));
        } else if (this.cats.has(cat.key) && this.cats.size === CATS.length) {
          this.cats = new Set([cat.key]);       // first tap = solo this lens
        } else if (this.cats.has(cat.key)) {
          this.cats.delete(cat.key);
        } else {
          this.cats.add(cat.key);
        }
        this.render();
      };
    }
    const search = bar.createEl("input", {
      cls: "sg-tl-search",
      attr: { type: "search", placeholder: "Find a person, place, or event…" },
    });
    search.value = this.query;
    search.oninput = () => { this.query = search.value; this.renderStream(); };

    // ---- the stream -----------------------------------------------------
    this.streamEl = c.createDiv({ cls: "sg-tl-stream" });
    this.renderStream();
    if (this.pendingYear != null) {
      const y = this.pendingYear;
      this.pendingYear = null;
      window.setTimeout(() => this.scrollToYear(y), 60);
    }
  }

  private renderStream(): void {
    const stream = this.streamEl;
    if (!stream) return;
    stream.empty();
    const events = this.visible();
    if (!events.length) {
      stream.createDiv({ cls: "sg-tl-empty", text: "Nothing matches these filters." });
      return;
    }
    let lastCentury: number | null = null;
    for (const e of events) {
      const century = e.y0 < 0
        ? -Math.ceil((-e.y0) / 100) * 100
        : Math.floor(Math.max(e.y0 - 1, 0) / 100) * 100 + 1;
      if (century !== lastCentury) {
        lastCentury = century;
        const title = e.y0 < 0 ? `${-century}-${-(century + 99)} BC`
          : `AD ${century}-${century + 99}`;
        const ruler = stream.createDiv({ cls: "sg-tl-ruler" });
        ruler.setAttr("data-year", String(century));
        ruler.createSpan({ text: title.replace("-", "–") });
        ruler.onclick = () => {
          void this.s.app.workspace.openLinkText(
            `AI Library/90 Timeline/${title}.md`, "");
        };
      }
      const side = e.lane === "ow" ? "sg-tl-left"
        : e.lane === "nw" ? "sg-tl-right" : "sg-tl-full";
      const row = stream.createDiv({ cls: `sg-tl-item ${side}` });
      row.setAttr("data-year", String(e.y0));
      const card = row.createDiv({ cls: `sg-tl-card sg-tl-${e.lane}` });
      const yr = e.y0 === e.y1 ? yearStr(e.y0)
        : `${yearStr(e.y0)} – ${yearStr(e.y1)}`;
      card.createDiv({ cls: "sg-tl-year", text: `${yr} · ${DATING_SHORT[e.dating] ?? e.dating}` });
      card.createDiv({ cls: "sg-tl-title", text: e.t });
      card.createDiv({ cls: "sg-tl-note", text: e.note });
      const links = card.createDiv({ cls: "sg-tl-links" });
      const link = (label: string, target: string) => {
        const b = links.createEl("button", { cls: "sg-tl-link", text: label });
        b.onclick = (evt) => {
          evt.stopPropagation();
          void this.s.app.workspace.openLinkText(target, "");
        };
      };
      for (const p of (e.people ?? []).slice(0, 3)) link(`🧑 ${p}`, p);
      for (const p of (e.places ?? []).slice(0, 2)) link(`🗺 ${p}`, p);
      for (const ch of (e.chapters ?? []).slice(0, 3)) link(`📖 ${ch}`, ch);
    }
  }

  private scrollToYear(y: number): void {
    const stream = this.streamEl;
    if (!stream) return;
    const nodes = Array.from(stream.querySelectorAll<HTMLElement>("[data-year]"));
    const hit = nodes.find(n => Number(n.getAttr("data-year")) >= y) ?? nodes[nodes.length - 1];
    hit?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }
}
