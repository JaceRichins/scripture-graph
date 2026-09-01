/** 🕰 The Timeline — all of scripture history on one scrollable spine.
 *
 * Time flows DOWN (phone-first). Old World events hang left of the spine,
 * Book of Mormon events right, the Restoration full-width. Century rulers
 * break the stream and open their anchor pages as sheets. Filtering is the
 * soul of it: era jumps, region and category chips, a detail toggle
 * (major-only by default — no data floods), and a search box that doubles
 * as a person/place spotlight. Event links ride the one link ladder:
 * verses peek, chapters open your study page, people float as sheets. */
import { ItemView, Modal, TFile, WorkspaceLeaf, type App } from "obsidian";
import { SGState } from "../state";
import { registerSheet, unregisterSheet } from "./sheetRegistry";

export const TIMELINE_VIEW = "sg-timeline";

export interface TimelineEvent {
  id: string; t: string; y0: number; y1: number;
  lane: "ow" | "nw" | "rs";
  imp: 1 | 2 | 3;
  cat: string[];
  dating: string;
  people?: string[]; places?: string[]; things?: string[]; chapters?: string[];
  note: string;
  /** storyline this event rides (Zeniff's colony, the Jaredites…) */
  thread?: string;
}

/** a concurrent storyline inside a lane — the Book of Mormon runs four at
 * once through the Mosiah years, and depth 2 braids them side by side */
export interface TimelineThread {
  id: string;
  lane: "ow" | "nw" | "rs";
  label: string;
  color: string;
  /** event id where this storyline splits off the main line */
  branch: string | null;
  /** whether the storyline flows back into the main line at its end */
  merges: boolean;
}

export type SubjectKind = "people" | "places" | "things";
export interface Subject { kind: SubjectKind; name: string }

const SUBJECT_META: Record<SubjectKind, { emoji: string; label: string }> = {
  people: { emoji: "🧑", label: "People" },
  places: { emoji: "🗺", label: "Places" },
  things: { emoji: "📦", label: "Things" },
};

export interface TimelineData {
  version: number;
  events: TimelineEvent[];
  book_years: Record<string, number>;
  threads?: TimelineThread[];
}

const DATA_PATH = "AI Library/90 Timeline/_data.md";

const ERAS: { label: string; y: number }[] = [
  { label: "Beginnings", y: -4000 },
  { label: "Abraham", y: -2000 },
  { label: "Exodus", y: -1446 },
  { label: "Kings", y: -1050 },
  { label: "Lehi & Exile", y: -605 },
  { label: "Judges", y: -130 },
  { label: "Christ", y: -6 },
  { label: "Apostles", y: 34 },
  { label: "Cumorah", y: 320 },
  { label: "Restoration", y: 1820 },
];

/** each age gets its own faint hue — scrolling travels through epochs */
const ERA_TINT: Record<string, string> = {
  "Beginnings": "rgba(146, 124, 255, 0.05)",
  "Abraham": "rgba(255, 196, 130, 0.04)",
  "Exodus": "rgba(255, 148, 96, 0.045)",
  "Kings": "rgba(255, 214, 126, 0.045)",
  "Lehi & Exile": "rgba(118, 196, 255, 0.05)",
  "Judges": "rgba(110, 232, 172, 0.045)",
  "Christ": "rgba(255, 240, 200, 0.06)",
  "Apostles": "rgba(255, 204, 156, 0.04)",
  "Cumorah": "rgba(224, 142, 128, 0.05)",
  "Restoration": "rgba(122, 182, 255, 0.055)",
};

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
  ["jaredite-end", "coriantumr-zarahemla"],
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
const LANE_NAME: Record<string, string> = {
  ow: "🌍 Bible", nw: "🌎 Book of Mormon", rs: "🌅 Restoration",
};
/** rails as FRACTIONS of the real container width — the layout is computed
 * in device pixels so text renders at true size on every screen (a scaled
 * viewBox shrank phone labels to ~40% and made the whole view feel old) */
const LANE_F: Record<string, number> = { ow: 0.13, nw: 0.87, rs: 0.5 };
/** which way a rail's text flows: toward the open middle, git-graph style */
const LANE_DIR: Record<string, 1 | -1> = { ow: 1, nw: -1, rs: 1 };
/** storyline columns, per lane, consumed in dataset order */
const THREAD_F: Record<string, number[]> = {
  ow: [0.27, 0.35], nw: [0.7, 0.62, 0.75, 0.55], rs: [0.4, 0.6],
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
  private depth: 1 | 2 = 2;       // 2 = storylines braid out of their lane
  private query = "";
  private focus: Subject | null = null;
  private pendingYear: number | null = null;
  private streamEl: HTMLElement | null = null;
  private showLenses = false;     // category row folded away by default
  private showSearch = false;     // search folded away by default
  private lastW = 0;
  private retriedZeroWidth = false;
  /** Obsidian calls this on pane resize; the window listener covers rotation */
  onResize(): void {
    const w = this.streamEl?.clientWidth ?? 0;
    if (w > 80 && Math.abs(w - this.lastW) > 24) this.renderStream();
  }
  private boundResize = () => this.onResize();

  /** enter/leave focus mode: the constellation becomes ONE subject's thread */
  setFocus(subject: Subject | null): void {
    this.focus = subject;
    this.render();
  }

  /** back to seeing everything — one tap out of any filter corner */
  private resetFilters(): void {
    this.lanes = new Set(["ow", "nw", "rs"]);
    this.cats = new Set(CATS.map(c => c.key));
    this.detail = false;
    this.query = "";
    this.showLenses = false;
    this.showSearch = false;
    this.render();
  }

  constructor(leaf: WorkspaceLeaf, private s: SGState) {
    super(leaf);
    this.navigation = true;   // a page: replaceable in-place, back-arrow aware
    const dev = (s as unknown as { device?: { tlDepth?: 1 | 2 } }).device;
    if (dev?.tlDepth === 1 || dev?.tlDepth === 2) this.depth = dev.tlDepth;
  }

  private saveDepth(): void {
    const s = this.s as unknown as {
      device?: { tlDepth?: 1 | 2 }; saveDevice?: () => Promise<void>;
    };
    if (s.device) { s.device.tlDepth = this.depth; void s.saveDevice?.(); }
  }

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
    // rotation / pane resize re-lays the constellation out at true pixels
    window.addEventListener("resize", this.boundResize);
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
    // focus mode: the subject decides — importance and category filters step
    // aside so the whole thread shows, references and all
    if (this.focus) {
      const { kind, name } = this.focus;
      return this.data.events
        .filter(e => (e[kind] ?? []).includes(name))
        .sort((a, b) => a.y0 - b.y0 || a.id.localeCompare(b.id));
    }
    const q = this.query.toLowerCase();
    return this.data.events.filter(e => {
      if (!this.lanes.has(e.lane)) return false;
      if (!this.detail && e.imp > 2) return false;
      if (!e.cat.some(c => this.cats.has(c))) return false;
      if (q) {
        const hay = [e.t, e.note, ...(e.people ?? []), ...(e.places ?? []),
          ...(e.things ?? []), ...(e.chapters ?? [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.y0 - b.y0 || a.id.localeCompare(b.id));
  }

  /** every subject the dataset knows, with how often it appears */
  private subjectIndex(kind: SubjectKind): { name: string; n: number }[] {
    const counts = new Map<string, number>();
    for (const e of this.data?.events ?? []) {
      for (const name of e[kind] ?? []) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
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

    // ---- focus banner: one subject's thread through time ----------------
    if (this.focus) {
      const meta = SUBJECT_META[this.focus.kind];
      const events = this.visible();
      const bar = c.createDiv({ cls: "sg-tl-bar" });
      const banner = bar.createDiv({ cls: "sg-tl-focus" });
      banner.createSpan({ cls: "sg-tl-focus-emoji", text: meta.emoji });
      const col = banner.createDiv({ cls: "sg-tl-focus-col" });
      col.createDiv({ cls: "sg-tl-focus-name", text: this.focus.name });
      col.createDiv({
        cls: "sg-tl-focus-sub",
        text: `${events.length} moment${events.length === 1 ? "" : "s"} across time`,
      });
      if (this.focus.kind !== "things") {
        const page = banner.createEl("button", { cls: "sg-tl-focus-btn", text: "↗" });
        page.setAttr("aria-label", "Open page");
        const name = this.focus.name;
        page.onclick = () => void this.s.app.workspace.openLinkText(name, "");
      }
      const swap = banner.createEl("button", { cls: "sg-tl-focus-btn", text: "🎯" });
      swap.setAttr("aria-label", "Focus something else");
      swap.onclick = () => new SubjectPickerModal(this.s, this,
        (sub) => this.setFocus(sub)).open();
      const exit = banner.createEl("button", { cls: "sg-tl-focus-btn", text: "✕" });
      exit.setAttr("aria-label", "Back to everything");
      exit.onclick = () => this.setFocus(null);
      this.streamEl = c.createDiv({ cls: "sg-tl-stream" });
      this.renderStream();
      return;
    }

    // ---- filter bar: words on everything — a control you have to guess at
    // is a control that gets guessed wrong ------------------------------
    const bar = c.createDiv({ cls: "sg-tl-bar" });
    const eras = bar.createDiv({ cls: "sg-tl-eras" });
    eras.createSpan({ cls: "sg-tl-rowcap", text: "Jump to" });
    for (const era of ERAS) {
      const b = eras.createEl("button", { cls: "sg-tl-era", text: era.label });
      b.setAttr("title", `Scroll to the ${era.label} era`);
      b.onclick = () => this.scrollToYear(era.y);
    }
    const row2 = bar.createDiv({ cls: "sg-tl-row" });
    // depth first — the graph-view way: 1 = one river per world, 2 = the
    // river braids: Zeniff, Alma, and Zarahemla side by side through Mosiah
    if (this.data.threads?.length) {
      const seg = row2.createDiv({ cls: "sg-tl-seg" });
      seg.createSpan({ cls: "sg-tl-seg-cap", text: "Depth" });
      const segDefs: [1 | 2, string, string][] = [
        [1, "1", "One line per world"],
        [2, "2", "Split the storylines apart"],
      ];
      for (const [d, label, hint] of segDefs) {
        const b = seg.createEl("button", { cls: "sg-tl-seg-btn", text: label });
        b.setAttr("aria-label", hint);
        b.setAttr("title", hint);
        b.toggleClass("sg-tl-seg-on", this.depth === d);
        b.onclick = () => {
          if (this.depth === d) return;
          this.depth = d;
          this.saveDepth();
          this.render();
        };
      }
    }
    // the three worlds as LABELED toggles — show/hide is obvious, and the
    // colored ring doubles as the legend for the rails below
    for (const key of ["ow", "nw", "rs"]) {
      const on = this.lanes.has(key);
      const b = row2.createEl("button", { cls: "sg-tl-worldc", text: LANE_NAME[key]! });
      const hint = `${on ? "Hide" : "Show"} ${LANE_NAME[key]!.slice(3)} events`;
      b.setAttr("title", hint);
      b.setAttr("aria-label", hint);
      b.style.setProperty("--sg-lane", LANE_COLOR[key]!);
      b.toggleClass("sg-tl-on", on);
      b.onclick = () => {
        if (this.lanes.has(key)) this.lanes.delete(key); else this.lanes.add(key);
        this.render();
      };
    }
    row2.createSpan({ cls: "sg-tl-div" });
    const iconChip = (text: string, hint: string, on: boolean,
      click: () => void) => {
      const b = row2.createEl("button", { cls: "sg-tl-tool", text });
      b.setAttr("aria-label", hint);
      b.setAttr("title", hint);
      b.toggleClass("sg-tl-on", on);
      b.onclick = click;
      return b;
    };
    iconChip(this.detail ? "🔎 Everything" : "⭐ Major only",
      "How much shows: the major moments, or every detail",
      this.detail, () => { this.detail = !this.detail; this.render(); });
    iconChip("🎯 Focus", "Follow one person, place, or thing through time", false,
      () => new SubjectPickerModal(this.s, this, (sub) => this.setFocus(sub)).open());
    const filtered = this.cats.size < CATS.length;
    iconChip(filtered ? `⚗ Lenses · ${this.cats.size}` : "⚗ Lenses",
      "Filter by kind of moment — prophets, wars, records…",
      this.showLenses || filtered,
      () => { this.showLenses = !this.showLenses; this.render(); });
    iconChip("🔍 Search", "Find a person, place, or event", this.showSearch || !!this.query,
      () => {
        this.showSearch = !this.showSearch;
        if (!this.showSearch) { this.query = ""; }
        this.render();
      });
    // an escape hatch the moment anything is filtered — no stranded views
    if (this.lanes.size < 3 || filtered || this.detail || this.query) {
      const reset = row2.createEl("button", { cls: "sg-tl-tool sg-tl-reset", text: "↺ Reset" });
      reset.setAttr("title", "Show everything again");
      reset.setAttr("aria-label", "Show everything again");
      reset.onclick = () => this.resetFilters();
    }

    if (this.showLenses) {
      const row3 = bar.createDiv({ cls: "sg-tl-row sg-tl-cats" });
      for (const cat of CATS) {
        const b = row3.createEl("button", { cls: "sg-tl-chip", text: cat.label });
        b.toggleClass("sg-tl-on", this.cats.has(cat.key));
        b.onclick = () => {
          // tapping the ONLY active category restores all — quick solo/reset
          if (this.cats.has(cat.key) && this.cats.size === 1) {
            this.cats = new Set(CATS.map(x => x.key));
          } else if (this.cats.has(cat.key) && this.cats.size === CATS.length) {
            this.cats = new Set([cat.key]);     // first tap = solo this lens
          } else if (this.cats.has(cat.key)) {
            this.cats.delete(cat.key);
          } else {
            this.cats.add(cat.key);
          }
          this.render();
        };
      }
    }
    if (this.showSearch || this.query) {
      const search = bar.createEl("input", {
        cls: "sg-tl-search",
        attr: { type: "search", placeholder: "Find a person, place, or event…" },
      });
      search.value = this.query;
      search.oninput = () => { this.query = search.value; this.renderStream(); };
      if (this.showSearch && !this.query) {
        window.setTimeout(() => search.focus(), 60);
      }
    }

    // ---- the stream -----------------------------------------------------
    this.streamEl = c.createDiv({ cls: "sg-tl-stream" });
    this.renderStream();
  }

  private yById = new Map<string, number>();
  private yByYear: [number, number][] = [];   // [year, yPx]

  /** at depth 2 every storyline earns its own column beside its lane —
   * assigned per lane in dataset order, so new threads slot in on their own */
  private threadX(W: number): Map<string, number> {
    const m = new Map<string, number>();
    const used: Record<string, number> = { ow: 0, nw: 0, rs: 0 };
    for (const t of this.data?.threads ?? []) {
      const lane = THREAD_F[t.lane] ?? THREAD_F.nw!;
      m.set(t.id, W * lane[Math.min(used[t.lane]!++, lane.length - 1)]!);
    }
    return m;
  }

  /** the constellation, laid out in true device pixels: luminous rails with
   * crisp text beside them (git-graph idiom — the open middle belongs to the
   * words), storyline braids at depth 2, narrative arcs between hemispheres */
  private renderStream(): void {
    const stream = this.streamEl;
    if (!stream) return;
    stream.empty();
    this.clearDetail();
    this.yById.clear();
    this.yByYear = [];
    const events = this.visible();
    if (!events.length) {
      const empty = stream.createDiv({ cls: "sg-tl-empty" });
      empty.createDiv({ text: "Nothing matches — every event is filtered out." });
      const back = empty.createEl("button", { cls: "sg-tl-retry", text: "↺ Show everything" });
      back.onclick = () => this.resetFilters();
      return;
    }

    // measure the real width; if we rendered before layout, try once more
    let cw = stream.clientWidth;
    if (cw < 80) {
      cw = 420;
      if (!this.retriedZeroWidth) {
        this.retriedZeroWidth = true;
        window.requestAnimationFrame(() => {
          if ((this.streamEl?.clientWidth ?? 0) > 80) this.renderStream();
        });
      }
    }
    this.lastW = cw;
    // the sky is full-bleed; the constellation lives in a centered column so
    // a wide desktop pane reads as one continuous space, not a dark panel
    const W = cw;
    const colW = Math.min(cw, 820);
    const off = Math.round((cw - colW) / 2);

    const tx = (!this.focus && this.depth === 2) ? this.threadX(colW) : new Map<string, number>();
    const threadById = new Map((this.data?.threads ?? []).map(t => [t.id, t]));
    const laneX = (lane: string) => off + colW * (LANE_F[lane] ?? 0.5);
    const xFor = (e: TimelineEvent) => {
      const t = e.thread ? tx.get(e.thread) : undefined;
      return t != null ? off + t : laneX(e.lane);
    };
    const onThread = (e: TimelineEvent) => !!e.thread && tx.has(e.thread);
    const dirFor = (e: TimelineEvent): 1 | -1 => LANE_DIR[e.lane] ?? 1;
    // organic placement, the graph view's idiom: every star drifts a seeded
    // distance off its rail and carries a depth — near stars run bigger and
    // brighter, far ones sit small and dim. Deterministic, so nothing jumps.
    const hash01 = (s: string): number => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    };

    // ---- layout: rank-spaced down the page, extra breath at century and
    // era turns — real pixels, no scaling anywhere
    const ROW = 78, CENTURY_GAP = 58, ERA_GAP = 66, TOP = 64, BOTTOM = 120;
    let y = TOP;
    let lastCentury: number | null = null;
    const centuries: { y: number; label: string; page: string; year: number }[] = [];
    const eraBands: { label: string; yTop: number; wmY: number }[] = [];
    let lastEra: string | null = null;
    const pos = new Map<string, { x: number; y: number; z: number; e: TimelineEvent }>();
    for (const e of events) {
      const century = e.y0 < 0
        ? -Math.ceil((-e.y0) / 100) * 100
        : Math.floor(Math.max(e.y0 - 1, 0) / 100) * 100 + 1;
      const era = [...ERAS].reverse().find(er => er.y <= e.y0);
      const eraTurn = !!era && era.label !== lastEra;
      if (eraTurn) {
        lastEra = era!.label;
        y += ERA_GAP;
        eraBands.push({ label: era!.label, yTop: y - ERA_GAP + 6, wmY: y - 14 });
      }
      if (century !== lastCentury) {
        lastCentury = century;
        y += CENTURY_GAP;
        const page = e.y0 < 0 ? `${-century}-${-(century + 99)} BC`
          : `AD ${century}-${century + 99}`;
        centuries.push({ y: y - 26, label: page.replace("-", "–"), page, year: century });
        this.yByYear.push([century, y - 26]);
      }
      // drift scales with the column — a phone's narrow sky keeps its stars
      // near their rails, a desktop's wide one lets them wander
      const amp = onThread(e) ? Math.min(24, colW * 0.03) : Math.min(60, colW * 0.07);
      const jitter = (hash01(e.id) - 0.5) * 2 * amp;
      const z = 0.76 + hash01(e.id + "~z") * 0.44;   // depth: 0.76 far … 1.2 near
      const jx = Math.min(Math.max(xFor(e) + Math.round(jitter), 24), W - 24);
      pos.set(e.id, { x: jx, y, z, e });
      this.yById.set(e.id, y);
      y += ROW;
    }
    const H = y + BOTTOM;

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
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
    el("feGaussianBlur", { stdDeviation: "4", result: "b" }, filt);
    const merge = el("feMerge", {}, filt);
    el("feMergeNode", { in: "b" }, merge);
    el("feMergeNode", { in: "SourceGraphic" }, merge);

    // ---- era washes: every age gets its own faint hue + a huge quiet name
    for (let i = 0; i < eraBands.length; i++) {
      const band = eraBands[i]!;
      const yEnd = eraBands[i + 1]?.yTop ?? H;
      el("rect", {
        x: "0", y: String(band.yTop), width: String(W),
        height: String(yEnd - band.yTop), class: "sg-tl-band",
        fill: ERA_TINT[band.label] ?? "rgba(255, 255, 255, 0.03)",
      });
      // size the watermark to FIT the column, long names included
      const fs = Math.min(
        Math.round(colW * 0.085), 64,
        Math.round(colW / (band.label.length * 0.78)));
      const wm = el("text", {
        x: String(W / 2), y: String(Math.max(band.wmY, TOP + 26)),
        "text-anchor": "middle",
        class: "sg-tl-erawash", style: `font-size: ${fs}px`,
      });
      wm.textContent = band.label.toUpperCase();
    }

    // ---- a living sky: seeded stars, each breathing at its own pace
    let seed = 9973;
    const rnd = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const nStars = Math.min(44, Math.max(10, Math.round(H / 240)));
    for (let i = 0; i < nStars; i++) {
      el("circle", {
        cx: String(Math.round(rnd() * W)),
        cy: String(Math.round(rnd() * H)),
        r: (0.7 + rnd() * 0.9).toFixed(2),
        class: "sg-tl-star",
        style: `animation-delay: -${(rnd() * 4.2).toFixed(2)}s;`
          + ` animation-duration: ${(3.4 + rnd() * 2.6).toFixed(2)}s`,
      });
    }

    const chainPath = (chain: { x: number; y: number }[]): string => {
      let d = "";
      for (let i = 0; i < chain.length; i++) {
        const p = chain[i]!;
        if (i === 0) { d = `M ${p.x} ${p.y}`; continue; }
        const prev = chain[i - 1]!;
        const midY = (prev.y + p.y) / 2;
        d += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      }
      return d;
    };
    // a rail is two strokes: a wide soft light and a thin bright core
    const rail = (d: string, color: string, core: number, coreCls: string) => {
      el("path", { d, class: "sg-tl-railglow", stroke: color,
        "stroke-width": String(core * 3.2) });
      el("path", { d, class: coreCls, stroke: color,
        "stroke-width": String(core) });
    };

    // every drawn edge gets a fat invisible twin that answers the question
    // "how much time sits between these two moments?" — hover for a glance,
    // tap to pin. The chip anchors at the POINTER, not the line's midpoint:
    // a web edge can span centuries of scroll, but you touched it HERE, so
    // the answer appears here — always inside the visible viewport.
    const toContent = (ev: MouseEvent): [number, number] => {
      const rc = stream.getBoundingClientRect();
      return [ev.clientX - rc.left, ev.clientY - rc.top + stream.scrollTop];
    };
    const gapHit = (a: TimelineEvent, b: TimelineEvent,
      context: string | null, litEl: Element | null = null,
      straight = false) => {
      const pa = pos.get(a.id)!, pb = pos.get(b.id)!;
      const n = straight
        ? el("line", {
          x1: String(pa.x), y1: String(pa.y), x2: String(pb.x), y2: String(pb.y),
          class: "sg-tl-hitline", "data-a": a.id, "data-b": b.id,
        })
        : el("path", {
          d: chainPath([pa, pb]), class: "sg-tl-hitline",
          "data-a": a.id, "data-b": b.id,
        });
      n.addEventListener("mouseenter", (ev) => {
        litEl?.classList.add("sg-tl-web-lit");
        const [x, y] = toContent(ev as MouseEvent);
        this.showGap(a, b, context, x, y, false);
      });
      n.addEventListener("mousemove", (ev) => {
        const [x, y] = toContent(ev as MouseEvent);
        this.moveGap(x, y);
      });
      n.addEventListener("mouseleave", () => {
        if (!litEl?.classList.contains("sg-tl-web-pin")) {
          litEl?.classList.remove("sg-tl-web-lit");
        }
        this.hideGap(false);
      });
      n.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.clearDetail();
        litEl?.classList.add("sg-tl-web-lit", "sg-tl-web-pin");
        const [x, y] = toContent(ev as MouseEvent);
        this.showGap(a, b, context, x, y, true);
      });
    };

    if (this.focus) {
      // ---- focus mode: ONE bright thread stitches the subject's whole
      // journey, crossing hemispheres wherever the subject did
      const chain = events.map(e => pos.get(e.id)!);
      if (chain.length > 1) el("path", { d: chainPath(chain), class: "sg-tl-focus-thread" });
      const fmeta = SUBJECT_META[this.focus.kind];
      for (let i = 1; i < events.length; i++) {
        gapHit(events[i - 1]!, events[i]!, `${fmeta.emoji} ${this.focus.name}`);
      }
    } else {
      // ---- the rails of time: one luminous line per world; at depth 2
      // storyline events step OUT of the main line into their own braid
      for (const lane of ["ow", "nw", "rs"]) {
        const laneEvents = events.filter(e => e.lane === lane && !onThread(e));
        const chain = laneEvents.map(e => pos.get(e.id)!);
        if (chain.length >= 2) rail(chainPath(chain), LANE_COLOR[lane]!, 2, "sg-tl-thread");
        for (let i = 1; i < laneEvents.length; i++) {
          gapHit(laneEvents[i - 1]!, laneEvents[i]!, LANE_NAME[lane]!);
        }
        // name the world where its story begins — high enough to clear the
        // century tag that shares the row above the first node
        if (laneEvents.length) {
          const first = pos.get(laneEvents[0]!.id)!;
          const dir = LANE_DIR[lane] ?? 1;
          const cap = el("text", {
            x: String(first.x + dir * 16), y: String(first.y - 46),
            "text-anchor": dir > 0 ? "start" : "end",
            class: "sg-tl-tcap", fill: LANE_COLOR[lane]!,
          });
          cap.textContent = LANE_NAME[lane]!;
        }
      }

      // ---- storyline braids: each concurrent narrative gets its own line,
      // a dashed split where it leaves the main story, a dashed return
      // where the peoples rejoin — Mosiah's four timelines, side by side
      if (tx.size) {
        for (const th of this.data?.threads ?? []) {
          const members = events.filter(e => e.thread === th.id);
          if (!members.length) continue;
          const chain = members.map(e => pos.get(e.id)!);
          if (chain.length > 1) rail(chainPath(chain), th.color, 1.6, "sg-tl-thread2");
          for (let i = 1; i < members.length; i++) {
            gapHit(members[i - 1]!, members[i]!, `↳ ${th.label}`);
          }
          const first = chain[0]!, last = chain[chain.length - 1]!;
          // split: only for storylines that really branched off another —
          // a standalone people (the Jaredites) simply begins
          if (th.branch) {
            const from = pos.get(th.branch)
              ?? { x: laneX(th.lane), y: first.y - 56 };
            const midA = (from.y + first.y) / 2;
            el("path", {
              d: `M ${from.x} ${from.y} C ${from.x} ${midA}, ${first.x} ${midA}, ${first.x} ${first.y}`,
              class: "sg-tl-branch", stroke: th.color,
            });
          }
          // rejoin: back to the next mainline event of this lane
          if (th.merges) {
            const back = events.find(e => e.lane === th.lane && !onThread(e)
              && (pos.get(e.id)?.y ?? 0) > last.y);
            const to = back ? pos.get(back.id)! : { x: laneX(th.lane), y: last.y + 56 };
            const midB = (last.y + to.y) / 2;
            el("path", {
              d: `M ${last.x} ${last.y} C ${last.x} ${midB}, ${to.x} ${midB}, ${to.x} ${to.y}`,
              class: "sg-tl-branch", stroke: th.color,
            });
          }
          // name the storyline where it begins, clear of the century tag row
          const dir = LANE_DIR[th.lane] ?? 1;
          const cap = el("text", {
            x: String(first.x + dir * 14), y: String(first.y - 42),
            "text-anchor": dir > 0 ? "start" : "end",
            class: "sg-tl-tcap sg-tl-tcap-sm", fill: th.color,
          });
          cap.textContent = `${th.branch ? "↳ " : ""}${th.label}`;
        }
      }

      // ---- the connection web: events sharing a person or a thing are
      // bound by faint straight edges, graph-view style — select a star and
      // its connections light up. Chained per subject (each moment links to
      // the subject's NEXT moment) so the web stays a constellation, not a
      // hairball; rails already joining two events aren't doubled.
      const railPairs = new Set<string>();
      const markChain = (chain: TimelineEvent[]) => {
        for (let i = 1; i < chain.length; i++) {
          railPairs.add(`${chain[i - 1]!.id}|${chain[i]!.id}`);
        }
      };
      for (const lane of ["ow", "nw", "rs"]) {
        markChain(events.filter(e => e.lane === lane && !onThread(e)));
      }
      for (const th of this.data?.threads ?? []) {
        markChain(events.filter(e => e.thread === th.id));
      }
      const bySubject = new Map<string, TimelineEvent[]>();
      for (const e of events) {
        const tagged = [
          ...(e.people ?? []).map(n => `🧑 ${n}`),
          ...(e.things ?? []).map(n => `📦 ${n}`),
        ];
        for (const s of tagged) {
          const arr = bySubject.get(s) ?? [];
          arr.push(e);
          bySubject.set(s, arr);
        }
      }
      const webPairs = new Map<string, [string, string, string | null]>();
      const addPair = (a: string, b: string, subject: string | null) => {
        if (a === b) return;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (railPairs.has(`${a}|${b}`) || railPairs.has(`${b}|${a}`)) return;
        if (!webPairs.has(key)) webPairs.set(key, [a, b, subject]);
      };
      for (const [subject, evs] of bySubject) {
        if (evs.length < 2 || evs.length > 9) continue;  // hubs become noise
        for (let i = 1; i < evs.length; i++) {
          addPair(evs[i - 1]!.id, evs[i]!.id, subject);
        }
      }
      const visibleIds = new Set(events.map(e => e.id));
      for (const [a, b] of NARRATIVE_LINKS) {
        if (visibleIds.has(a) && visibleIds.has(b)) addPair(a, b, null);
      }
      const strong = new Set(NARRATIVE_LINKS.map(([a, b]) =>
        a < b ? `${a}|${b}` : `${b}|${a}`));
      for (const [key, [a, b, subject]] of webPairs) {
        const pa = pos.get(a)!, pb = pos.get(b)!;
        const dy = Math.abs(pb.y - pa.y);
        const o = Math.max(0.05, (strong.has(key) ? 0.24 : 0.17) - dy / 14000);
        const line = el("line", {
          x1: String(pa.x), y1: String(pa.y), x2: String(pb.x), y2: String(pb.y),
          class: "sg-tl-web", "data-a": a, "data-b": b,
          style: `stroke-opacity: ${o.toFixed(3)}`,
        });
        gapHit(pa.e, pb.e, subject, line, true);
      }

      // ---- person spotlight: connect events sharing the searched name
      const q = this.query.trim().toLowerCase();
      if (q.length >= 3) {
        const hits = events.filter(e =>
          (e.people ?? []).some(p => p.toLowerCase().includes(q)));
        for (let i = 1; i < hits.length; i++) {
          const pa = pos.get(hits[i - 1]!.id)!, pb = pos.get(hits[i]!.id)!;
          el("path", {
            d: `M ${pa.x} ${pa.y} Q ${(pa.x + pb.x) / 2 + 40} ${(pa.y + pb.y) / 2}, ${pb.x} ${pb.y}`,
            class: "sg-tl-spot",
          });
        }
      }
    }

    // ---- century marks: a small centered tag in the gap (tap → anchor
    // page); drawn after the hit lines so a rail crossing the middle never
    // swallows their taps
    for (const c of centuries) {
      const t = el("text", {
        x: String(W / 2), y: String(c.y), "text-anchor": "middle",
        class: "sg-tl-century",
      });
      t.textContent = c.label;
      (t as unknown as SVGElement & { onclick: unknown }).onclick = () => {
        void this.s.app.workspace.openLinkText(`AI Library/90 Timeline/${c.page}.md`, "");
      };
    }

    // ---- nodes + labels beside them, flowing toward the open middle
    let nodeIdx = 0;
    for (const e of events) {
      const p = pos.get(e.id)!;
      const r = (e.imp === 1 ? 9 : e.imp === 2 ? 6.5 : 4.5) * p.z;
      const braided = onThread(e);
      const color = (braided && e.thread ? threadById.get(e.thread)?.color : undefined)
        ?? LANE_COLOR[e.lane]!;
      const outer = el("g", {
        class: "sg-tl-node", "data-id": e.id,
        // constellation lights up star by star
        style: `animation-delay: ${Math.min(nodeIdx * 22, 480)}ms`,
      });
      // …then each star keeps drifting gently on its own current
      const g = el("g", {
        class: "sg-tl-float",
        style: `animation-delay: -${(hash01(e.id + "~f") * 8).toFixed(2)}s;`
          + ` animation-duration: ${(6.5 + hash01(e.id + "~d") * 4).toFixed(2)}s`,
      }, outer);
      nodeIdx++;
      // a generous invisible target under everything — thumbs, not cursors
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: "24",
        class: "sg-tl-hit",
      }, g);
      // halo → glowing core → a glint of light: stars, not dots;
      // the major moments breathe softly, each on its own rhythm
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: String((r + 7).toFixed(1)),
        fill: color,
        class: e.imp === 1 ? "sg-tl-halo sg-tl-halo-breathe" : "sg-tl-halo",
        style: e.imp === 1 ? `animation-delay: -${(nodeIdx % 7) * 0.8}s` : "",
      }, g);
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: String(r),
        fill: color, filter: "url(#sgtlglow)",
        class: "sg-tl-dot",
      }, g);
      el("circle", {
        cx: String(p.x - r * 0.3), cy: String(p.y - r * 0.3),
        r: String(Math.max(1.1, r * 0.28)), class: "sg-tl-glint",
      }, g);
      // title + tinted year, crisp and beside the node
      const dir = dirFor(e);
      const tx0 = p.x + dir * (r + 12);
      const avail = dir > 0 ? W - 16 - tx0 : tx0 - 16;
      // generous first cut — the exact fit is measured after mount, because
      // every device renders type a little differently
      const per = e.imp === 1 && !braided ? 7.2 : 6.2;
      const maxCh = Math.max(10, Math.floor(avail / per));
      const label = e.t.length > maxCh ? `${e.t.slice(0, maxCh - 1)}…` : e.t;
      const cls = braided ? "sg-tl-label sg-tl-label-sm"
        : e.imp === 1 ? "sg-tl-label sg-tl-label-big"
          : e.imp === 3 ? "sg-tl-label sg-tl-label-sm" : "sg-tl-label";
      const anchor = dir > 0 ? "start" : "end";
      const t1 = el("text", {
        x: String(tx0), y: String(p.y - 2), "text-anchor": anchor, class: cls,
        "data-avail": String(Math.max(56, Math.round(avail))),
      }, g);
      t1.textContent = label;
      const t2 = el("text", {
        x: String(tx0), y: String(p.y + 14), "text-anchor": anchor,
        class: "sg-tl-year", fill: color,
      }, g);
      t2.textContent = `${yearStr(e.y0)} · ${DATING_SHORT[e.dating] ?? e.dating}`;
      (outer as unknown as SVGElement & { onclick: unknown }).onclick =
        () => this.selectNode(e, outer);
    }

    stream.appendChild(svg);

    // exact label fit: measure the RENDERED width and trim what overflows —
    // heuristics guess, devices differ, the ruler doesn't
    svg.querySelectorAll("text[data-avail]").forEach(node => {
      const t = node as SVGTextElement;
      if (typeof t.getComputedTextLength !== "function") return;
      const fit = Number(t.getAttribute("data-avail"));
      if (!fit || t.getComputedTextLength() <= fit) return;
      let base = (t.textContent ?? "").replace(/…$/, "");
      while (base.length > 6 && t.getComputedTextLength() > fit) {
        base = base.slice(0, -1);
        t.textContent = base.trimEnd() + "…";
      }
    });

    // tap empty space clears the detail card (edge taps handle themselves)
    svg.addEventListener("click", (evt) => {
      if ((evt.target as Element).closest(".sg-tl-node, .sg-tl-hitline")) return;
      this.clearDetail();
    });

    if (this.pendingYear != null) {
      const py = this.pendingYear;
      this.pendingYear = null;
      window.setTimeout(() => this.scrollToYear(py), 60);
    }
  }

  private detailEl: HTMLElement | null = null;

  private clearDetail(): void {
    this.detailEl?.remove();
    this.detailEl = null;
    this.hideGap(true);
    this.streamEl?.querySelectorAll(".sg-tl-sel").forEach(n => n.classList.remove("sg-tl-sel"));
    this.streamEl?.querySelectorAll(".sg-tl-web-lit").forEach(n =>
      n.classList.remove("sg-tl-web-lit", "sg-tl-web-pin"));
  }

  // ---- the time-between chip: floats at an edge's midpoint --------------
  private gapEl: HTMLElement | null = null;
  private gapPinned = false;

  private showGap(a: TimelineEvent, b: TimelineEvent, context: string | null,
    x: number, y: number, pin: boolean): void {
    if (this.gapPinned && !pin) return;
    this.gapEl?.remove();
    this.gapEl = null;
    this.gapPinned = pin;
    const stream = this.streamEl;
    if (!stream) return;
    const [ea, eb] = a.y0 <= b.y0 ? [a, b] : [b, a];
    const delta = eb.y0 - ea.y0;
    // honesty rides along: a traditional/approximate endpoint makes it a "≈"
    const soft = [ea.dating, eb.dating]
      .some(d => d === "traditional" || d === "approximate");
    const chip = stream.createDiv({ cls: "sg-tl-gap" });
    chip.createDiv({
      cls: "sg-tl-gap-main",
      text: delta === 0 ? "the same years"
        : `${soft ? "≈ " : ""}${delta.toLocaleString()} year${delta === 1 ? "" : "s"} apart`,
    });
    chip.createDiv({
      cls: "sg-tl-gap-sub",
      text: `${context ? context + " · " : ""}${yearStr(ea.y0)} → ${yearStr(eb.y0)}`,
    });
    this.gapEl = chip;
    this.placeGap(x, y);
  }

  /** anchor the chip at (x, y) content coords, clamped INSIDE the visible
   * viewport — a long edge's far reaches never strand the answer offscreen */
  private placeGap(x: number, y: number): void {
    const stream = this.streamEl, chip = this.gapEl;
    if (!stream || !chip) return;
    const cx = Math.min(Math.max(x, 96), Math.max(200, stream.clientWidth - 96));
    const top = stream.scrollTop;
    const cy = Math.min(Math.max(y, top + 14), top + stream.clientHeight - 20);
    // near the viewport's top edge the chip flips below the pointer
    chip.toggleClass("sg-tl-gap-below", cy - top < 76);
    chip.style.left = `${Math.round(cx)}px`;
    chip.style.top = `${Math.round(cy)}px`;
  }

  /** the transient chip follows the pointer along the line */
  private moveGap(x: number, y: number): void {
    if (this.gapPinned) return;
    this.placeGap(x, y);
  }

  private hideGap(force: boolean): void {
    if (this.gapPinned && !force) return;
    this.gapEl?.remove();
    this.gapEl = null;
    if (force) this.gapPinned = false;
  }

  /** the tapped node lights up; its web connections glow; its story slides
   * in at the bottom */
  private selectNode(e: TimelineEvent, g: Element): void {
    this.clearDetail();
    g.classList.add("sg-tl-sel");
    this.streamEl?.querySelectorAll(".sg-tl-web").forEach(l => {
      if (l.getAttribute("data-a") === e.id || l.getAttribute("data-b") === e.id) {
        l.classList.add("sg-tl-web-lit");
      }
    });
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
    // inside the timeline, people/places/things chips FOCUS that subject —
    // this view's own currency; chapter chips are the references and read
    const focusChip = (kind: SubjectKind, name: string) => {
      const b = links.createEl("button", {
        cls: "sg-tl-link",
        text: `${SUBJECT_META[kind].emoji} ${name}`,
      });
      b.onclick = () => this.setFocus({ kind, name });
    };
    for (const p of (e.people ?? []).slice(0, 3)) focusChip("people", p);
    for (const p of (e.places ?? []).slice(0, 2)) focusChip("places", p);
    for (const th of (e.things ?? []).slice(0, 3)) focusChip("things", th);
    for (const ch of (e.chapters ?? []).slice(0, 3)) {
      const b = links.createEl("button", { cls: "sg-tl-link sg-tl-link-ref", text: `📖 ${ch}` });
      b.onclick = () => void this.s.app.workspace.openLinkText(ch, "");
    }
  }

  private scrollToYear(y: number): void {
    const stream = this.streamEl;
    if (!stream) return;
    const hit = this.yByYear.find(([yr]) => yr >= y) ?? this.yByYear[this.yByYear.length - 1];
    if (!hit) return;
    stream.scrollTo({ top: Math.max(0, hit[1] - 64), behavior: "smooth" });
  }

  async onClose(): Promise<void> {
    window.removeEventListener("resize", this.boundResize);
    this.contentEl.empty();
  }

  /** exposed for the picker: every subject with its appearance count */
  subjectsOf(kind: SubjectKind): { name: string; n: number }[] {
    return this.subjectIndex(kind);
  }
}

/** 🎯 pick a person, place, or thing — its whole timeline follows */
export class SubjectPickerModal extends Modal {
  private query = "";
  private listEl: HTMLElement | null = null;

  constructor(
    s: SGState,
    private view: TimelineView,
    private onPick: (subject: Subject) => void,
  ) {
    super(s.app);
  }

  onOpen(): void {
    registerSheet(this);
    this.modalEl.addClass("sg-tlp-modal");
    const c = this.contentEl;
    c.addClass("sg-tlp");
    c.createEl("h3", { cls: "sg-tlp-title", text: "🎯 Focus the timeline on…" });
    const search = c.createEl("input", {
      cls: "sg-nav-filter",
      attr: { type: "search", placeholder: "Type a name — Nephi, Jerusalem, Gold Plates…" },
    });
    search.oninput = () => { this.query = search.value; this.renderList(); };
    this.listEl = c.createDiv({ cls: "sg-tlp-list" });
    this.renderList();
    window.setTimeout(() => search.focus(), 80);
  }

  private renderList(): void {
    const list = this.listEl;
    if (!list) return;
    list.empty();
    const q = this.query.trim().toLowerCase();
    for (const kind of ["things", "people", "places"] as SubjectKind[]) {
      const subjects = this.view.subjectsOf(kind)
        .filter(s => !q || s.name.toLowerCase().includes(q))
        .slice(0, q ? 12 : 8);
      if (!subjects.length) continue;
      list.createDiv({ cls: "sg-nav-sect", text: `${SUBJECT_META[kind].emoji} ${SUBJECT_META[kind].label}` });
      for (const s of subjects) {
        const row = list.createDiv({ cls: "sg-nav-row" });
        row.createSpan({ cls: "sg-nav-emoji", text: SUBJECT_META[kind].emoji });
        row.createSpan({ cls: "sg-nav-name", text: s.name });
        row.createSpan({ cls: "sg-tlp-count", text: `${s.n}` });
        row.onclick = () => { this.close(); this.onPick({ kind, name: s.name }); };
      }
    }
    if (!list.childElementCount) {
      list.createDiv({ cls: "sg-nav-empty", text: "No one and nothing by that name yet." });
    }
  }

  onClose(): void {
    unregisterSheet(this);
    this.contentEl.empty();
  }
}
