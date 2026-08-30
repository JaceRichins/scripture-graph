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

/** narrative threads that cross the lanes — the connections that make this
 * a graph and not a list. Pairs of event ids; missing ids are skipped. */
const NARRATIVE_LINKS: [string, string][] = [
  ["babel", "jaredite-voyage"],
  ["jerusalem-falls", "lehi-departs"],
  ["isaiah", "brass-plates"],
  ["resurrection", "christ-bountiful"],
  ["samuel-lamanite", "christ-birth"],
  ["cumorah", "moroni-visits"],
  ["moroni-alone", "bom-published"],
  ["malachi", "kirtland-temple"],
];

const LANE_COLOR: Record<string, string> = {
  ow: "#d9a441", nw: "#4cc38a", rs: "#52a9ff",
};
const LANE_X: Record<string, number> = { ow: 300, nw: 700, rs: 500 };
const W = 1000;

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

  private yById = new Map<string, number>();
  private yByYear: [number, number][] = [];   // [year, yUnits]

  /** the constellation: glowing nodes on two threads of time, narrative
   * links arcing between the hemispheres — the graph view, given order */
  private renderStream(): void {
    const stream = this.streamEl;
    if (!stream) return;
    stream.empty();
    this.clearDetail();
    this.yById.clear();
    this.yByYear = [];
    const events = this.visible();
    if (!events.length) {
      stream.createDiv({ cls: "sg-tl-empty", text: "Nothing matches these filters." });
      return;
    }

    // ---- layout: rank-spaced down the page, extra breath at century turns
    const ROW = 92, CENTURY_GAP = 74, TOP = 60, BOTTOM = 140;
    let y = TOP;
    let lastCentury: number | null = null;
    const centuries: { y: number; label: string; page: string; year: number }[] = [];
    const pos = new Map<string, { x: number; y: number; e: TimelineEvent }>();
    for (const e of events) {
      const century = e.y0 < 0
        ? -Math.ceil((-e.y0) / 100) * 100
        : Math.floor(Math.max(e.y0 - 1, 0) / 100) * 100 + 1;
      if (century !== lastCentury) {
        lastCentury = century;
        y += CENTURY_GAP;
        const page = e.y0 < 0 ? `${-century}-${-(century + 99)} BC`
          : `AD ${century}-${century + 99}`;
        centuries.push({ y: y - 34, label: page.replace("-", "–"), page, year: century });
        this.yByYear.push([century, y - 34]);
      }
      pos.set(e.id, { x: LANE_X[e.lane] ?? 500, y, e });
      this.yById.set(e.id, y);
      y += ROW;
    }
    const H = y + BOTTOM;

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMin meet");
    svg.classList.add("sg-tl-svg");
    const el = (tag: string, attrs: Record<string, string>, parent: Element = svg) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      parent.appendChild(n);
      return n;
    };

    // soft glow filter, once
    const defs = el("defs", {});
    const filt = el("filter", { id: "sgtlglow", x: "-80%", y: "-80%", width: "260%", height: "260%" }, defs);
    el("feGaussianBlur", { stdDeviation: "7", result: "b" }, filt);
    const merge = el("feMerge", {}, filt);
    el("feMergeNode", { in: "b" }, merge);
    el("feMergeNode", { in: "SourceGraphic" }, merge);

    // ---- century lines (tappable → anchor page sheet)
    for (const c of centuries) {
      el("line", {
        x1: "70", x2: String(W - 70), y1: String(c.y), y2: String(c.y),
        class: "sg-tl-cline",
      });
      const t = el("text", {
        x: "78", y: String(c.y - 10), class: "sg-tl-clabel",
      });
      t.textContent = c.label;
      (t as unknown as SVGElement & { onclick: unknown }).onclick = () => {
        void this.s.app.workspace.openLinkText(`AI Library/90 Timeline/${c.page}.md`, "");
      };
    }

    // ---- the threads of time: one luminous line per lane
    for (const lane of ["ow", "nw", "rs"]) {
      const chain = events.filter(e => e.lane === lane);
      if (chain.length < 2) continue;
      let d = "";
      for (let i = 0; i < chain.length; i++) {
        const p = pos.get(chain[i]!.id)!;
        if (i === 0) { d = `M ${p.x} ${p.y}`; continue; }
        const prev = pos.get(chain[i - 1]!.id)!;
        const midY = (prev.y + p.y) / 2;
        d += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      }
      el("path", { d, class: "sg-tl-thread", stroke: LANE_COLOR[lane]! });
    }

    // ---- narrative arcs between hemispheres
    const visibleIds = new Set(events.map(e => e.id));
    for (const [a, b] of NARRATIVE_LINKS) {
      if (!visibleIds.has(a) || !visibleIds.has(b)) continue;
      const pa = pos.get(a)!, pb = pos.get(b)!;
      const bow = (500 - (pa.x + pb.x) / 2) * 0.9 + 500;
      el("path", {
        d: `M ${pa.x} ${pa.y} Q ${bow} ${(pa.y + pb.y) / 2}, ${pb.x} ${pb.y}`,
        class: "sg-tl-arc",
      });
    }

    // ---- person spotlight: connect events sharing the searched name
    const q = this.query.trim().toLowerCase();
    if (q.length >= 3) {
      const hits = events.filter(e =>
        (e.people ?? []).some(p => p.toLowerCase().includes(q)));
      for (let i = 1; i < hits.length; i++) {
        const pa = pos.get(hits[i - 1]!.id)!, pb = pos.get(hits[i]!.id)!;
        el("path", {
          d: `M ${pa.x} ${pa.y} Q ${(pa.x + pb.x) / 2 + 60} ${(pa.y + pb.y) / 2}, ${pb.x} ${pb.y}`,
          class: "sg-tl-spot",
        });
      }
    }

    // ---- nodes + labels
    for (const e of events) {
      const p = pos.get(e.id)!;
      const r = e.imp === 1 ? 15 : e.imp === 2 ? 10 : 7;
      const g = el("g", { class: "sg-tl-node", "data-id": e.id });
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: String(r),
        fill: LANE_COLOR[e.lane]!, filter: "url(#sgtlglow)",
        class: "sg-tl-dot",
      }, g);
      // labels hang below their node, centered — the graph view's own idiom
      const label = e.t.length > 30 ? `${e.t.slice(0, 28)}…` : e.t;
      const t1 = el("text", {
        x: String(p.x), y: String(p.y + r + 26), "text-anchor": "middle",
        class: e.imp === 1 ? "sg-tl-label sg-tl-label-big" : "sg-tl-label",
      }, g);
      t1.textContent = label;
      const t2 = el("text", {
        x: String(p.x), y: String(p.y + r + 50), "text-anchor": "middle",
        class: "sg-tl-sublabel",
      }, g);
      t2.textContent = yearStr(e.y0);
      (g as unknown as SVGElement & { onclick: unknown }).onclick = () => this.selectNode(e, g);
    }

    stream.appendChild(svg);

    // tap empty space clears the detail card
    svg.addEventListener("click", (evt) => {
      if ((evt.target as Element).closest(".sg-tl-node")) return;
      this.clearDetail();
    });
  }

  private detailEl: HTMLElement | null = null;

  private clearDetail(): void {
    this.detailEl?.remove();
    this.detailEl = null;
    this.streamEl?.querySelectorAll(".sg-tl-sel").forEach(n => n.classList.remove("sg-tl-sel"));
  }

  /** the tapped node lights up; its story slides in at the bottom */
  private selectNode(e: TimelineEvent, g: Element): void {
    this.clearDetail();
    g.classList.add("sg-tl-sel");
    const card = this.contentEl.createDiv({ cls: "sg-tl-detail" });
    this.detailEl = card;
    const yr = e.y0 === e.y1 ? yearStr(e.y0) : `${yearStr(e.y0)} – ${yearStr(e.y1)}`;
    const head = card.createDiv({ cls: "sg-tl-detail-head" });
    head.createSpan({ cls: "sg-tl-detail-year", text: `${yr} · ${DATING_SHORT[e.dating] ?? e.dating}` });
    const close = head.createEl("button", { cls: "sg-tl-detail-x", text: "✕" });
    close.onclick = () => this.clearDetail();
    card.createDiv({ cls: "sg-tl-detail-title", text: e.t });
    card.createDiv({ cls: "sg-tl-detail-note", text: e.note });
    const links = card.createDiv({ cls: "sg-tl-links" });
    const link = (label: string, target: string) => {
      const b = links.createEl("button", { cls: "sg-tl-link", text: label });
      b.onclick = () => void this.s.app.workspace.openLinkText(target, "");
    };
    for (const p of (e.people ?? []).slice(0, 3)) link(`🧑 ${p}`, p);
    for (const p of (e.places ?? []).slice(0, 2)) link(`🗺 ${p}`, p);
    for (const ch of (e.chapters ?? []).slice(0, 3)) link(`📖 ${ch}`, ch);
  }

  private scrollToYear(y: number): void {
    const stream = this.streamEl;
    if (!stream) return;
    const hit = this.yByYear.find(([yr]) => yr >= y) ?? this.yByYear[this.yByYear.length - 1];
    if (!hit) return;
    const scale = stream.clientWidth / W;
    stream.scrollTo({ top: Math.max(0, hit[1] * scale - 70), behavior: "smooth" });
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }
}
