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
  private depth: 1 | 2 = 2;       // 2 = storylines braid out of their lane
  private query = "";
  private focus: Subject | null = null;
  private pendingYear: number | null = null;
  private streamEl: HTMLElement | null = null;

  /** enter/leave focus mode: the constellation becomes ONE subject's thread */
  setFocus(subject: Subject | null): void {
    this.focus = subject;
    this.render();
  }

  constructor(leaf: WorkspaceLeaf, private s: SGState) {
    super(leaf);
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

    // ---- filter bar -----------------------------------------------------
    const bar = c.createDiv({ cls: "sg-tl-bar" });
    const eras = bar.createDiv({ cls: "sg-tl-eras" });
    for (const era of ERAS) {
      const b = eras.createEl("button", { cls: "sg-tl-era", text: era.label });
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
        [2, "2", "Split out the storylines"],
      ];
      for (const [d, label, hint] of segDefs) {
        const b = seg.createEl("button", { cls: "sg-tl-seg-btn", text: label });
        b.setAttr("aria-label", hint);
        b.toggleClass("sg-tl-seg-on", this.depth === d);
        b.onclick = () => {
          if (this.depth === d) return;
          this.depth = d;
          this.saveDepth();
          this.render();
        };
      }
    }
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
    const focusBtn = row2.createEl("button", { cls: "sg-tl-chip", text: "🎯 Focus…" });
    focusBtn.toggleClass("sg-tl-on", true);
    focusBtn.onclick = () => new SubjectPickerModal(this.s, this,
      (sub) => this.setFocus(sub)).open();

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

  /** at depth 2 every storyline earns its own column beside its lane —
   * assigned per lane in dataset order, so new threads slot in on their own */
  private threadX(): Map<string, number> {
    const m = new Map<string, number>();
    const slots: Record<string, number[]> = {
      ow: [160, 105], nw: [845, 915, 775, 950], rs: [590, 640],
    };
    const used: Record<string, number> = { ow: 0, nw: 0, rs: 0 };
    for (const t of this.data?.threads ?? []) {
      const lane = slots[t.lane] ?? slots.nw!;
      m.set(t.id, lane[Math.min(used[t.lane]!++, lane.length - 1)]!);
    }
    return m;
  }

  /** the constellation: glowing nodes on braided threads of time, narrative
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

    // sticky legend: the three worlds stay named while you scroll the ages
    if (!this.focus) {
      const legend = stream.createDiv({ cls: "sg-tl-legend" });
      const legendDefs: [string, string][] = [["ow", "Old World"],
        ["rs", "Restoration"], ["nw", "Book of Mormon"]];
      for (const [key, label] of legendDefs) {
        if (!this.lanes.has(key)) continue;
        const it = legend.createSpan({ cls: "sg-tl-legend-item", text: label });
        it.style.setProperty("--sg-lane", LANE_COLOR[key]!);
      }
    }

    const tx = (!this.focus && this.depth === 2) ? this.threadX() : new Map<string, number>();
    const threadById = new Map((this.data?.threads ?? []).map(t => [t.id, t]));
    const xFor = (e: TimelineEvent) =>
      (e.thread ? tx.get(e.thread) : undefined) ?? LANE_X[e.lane] ?? 500;
    const onThread = (e: TimelineEvent) => !!e.thread && tx.has(e.thread);

    // ---- layout: rank-spaced down the page, extra breath at century turns
    const ROW = 92, CENTURY_GAP = 74, TOP = 60, BOTTOM = 140;
    let y = TOP;
    let lastCentury: number | null = null;
    const centuries: { y: number; label: string; page: string; year: number }[] = [];
    const eraBands: { label: string; yTop: number }[] = [];
    let lastEra: string | null = null;
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
      const era = [...ERAS].reverse().find(er => er.y <= e.y0);
      if (era && era.label !== lastEra) {
        lastEra = era.label;
        eraBands.push({ label: era.label, yTop: y - CENTURY_GAP + 8 });
      }
      pos.set(e.id, { x: xFor(e), y, e });
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

    // ---- era washes: faint alternating bands with huge watermark names,
    // so a fast scroll still tells you WHEN you are
    for (let i = 0; i < eraBands.length; i++) {
      const band = eraBands[i]!;
      const yEnd = eraBands[i + 1]?.yTop ?? H;
      if (i % 2 === 0) {
        el("rect", {
          x: "0", y: String(band.yTop), width: String(W),
          height: String(yEnd - band.yTop), class: "sg-tl-band",
        });
      }
      const wm = el("text", {
        x: "500", y: String(band.yTop + 96), "text-anchor": "middle",
        class: "sg-tl-erawash",
      });
      wm.textContent = band.label.toUpperCase();
    }

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

    if (this.focus) {
      // ---- focus mode: ONE bright thread stitches the subject's whole
      // journey, crossing hemispheres wherever the subject did
      let d = "";
      for (let i = 0; i < events.length; i++) {
        const p = pos.get(events[i]!.id)!;
        if (i === 0) { d = `M ${p.x} ${p.y}`; continue; }
        const prev = pos.get(events[i - 1]!.id)!;
        const midY = (prev.y + p.y) / 2;
        d += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
      }
      if (events.length > 1) el("path", { d, class: "sg-tl-focus-thread" });
    } else {
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

      // ---- the threads of time: one luminous line per lane; at depth 2
      // storyline events step OUT of the main line into their own braid
      for (const lane of ["ow", "nw", "rs"]) {
        const chain = events
          .filter(e => e.lane === lane && !onThread(e))
          .map(e => pos.get(e.id)!);
        if (chain.length < 2) continue;
        el("path", { d: chainPath(chain), class: "sg-tl-thread", stroke: LANE_COLOR[lane]! });
      }

      // ---- storyline braids: each concurrent narrative gets its own line,
      // a dashed split where it leaves the main story, a dashed return
      // where the peoples rejoin — Mosiah's four timelines, side by side
      if (tx.size) {
        for (const th of this.data?.threads ?? []) {
          const members = events.filter(e => e.thread === th.id);
          if (!members.length) continue;
          const chain = members.map(e => pos.get(e.id)!);
          if (chain.length > 1) {
            el("path", { d: chainPath(chain), class: "sg-tl-thread2", stroke: th.color });
          }
          const first = chain[0]!, last = chain[chain.length - 1]!;
          // split: from the branch event if it's on screen, else out of the lane
          const from = (th.branch ? pos.get(th.branch) : undefined)
            ?? { x: LANE_X[th.lane] ?? 500, y: first.y - 64 };
          const midA = (from.y + first.y) / 2;
          el("path", {
            d: `M ${from.x} ${from.y} C ${from.x} ${midA}, ${first.x} ${midA}, ${first.x} ${first.y}`,
            class: "sg-tl-branch", stroke: th.color,
          });
          // rejoin: back to the next mainline event of this lane
          if (th.merges) {
            const back = events.find(e => e.lane === th.lane && !onThread(e)
              && (pos.get(e.id)?.y ?? 0) > last.y);
            const to = back ? pos.get(back.id)! : { x: LANE_X[th.lane] ?? 500, y: last.y + 64 };
            const midB = (last.y + to.y) / 2;
            el("path", {
              d: `M ${last.x} ${last.y} C ${last.x} ${midB}, ${to.x} ${midB}, ${to.x} ${to.y}`,
              class: "sg-tl-branch", stroke: th.color,
            });
          }
          // name the storyline where it begins
          const capRight = first.x >= 500;
          const cap = el("text", {
            x: String(first.x + (capRight ? -20 : 20)),
            y: String(first.y - 22),
            "text-anchor": capRight ? "end" : "start",
            class: "sg-tl-tcap", fill: th.color,
          });
          cap.textContent = `↳ ${th.label}`;
        }
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
    }

    // ---- nodes + labels
    for (const e of events) {
      const p = pos.get(e.id)!;
      const r = e.imp === 1 ? 15 : e.imp === 2 ? 10 : 7;
      const braided = onThread(e);
      const color = (braided && e.thread ? threadById.get(e.thread)?.color : undefined)
        ?? LANE_COLOR[e.lane]!;
      const g = el("g", { class: "sg-tl-node", "data-id": e.id });
      // halo → glowing core → a glint of light: stars, not dots
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: String(r + 9),
        fill: color, class: "sg-tl-halo",
      }, g);
      el("circle", {
        cx: String(p.x), cy: String(p.y), r: String(r),
        fill: color, filter: "url(#sgtlglow)",
        class: "sg-tl-dot",
      }, g);
      el("circle", {
        cx: String(p.x - r * 0.32), cy: String(p.y - r * 0.32),
        r: String(Math.max(1.6, r * 0.3)), class: "sg-tl-glint",
      }, g);
      // labels hang below their node, centered — the graph view's own idiom;
      // braided columns sit near the edge, so their labels shrink and clamp
      const max = braided ? 22 : 30;
      const label = e.t.length > max ? `${e.t.slice(0, max - 2)}…` : e.t;
      const lx = braided
        ? Math.min(Math.max(p.x, 110), 890)
        : Math.min(Math.max(p.x, 150), 850);
      const cls = braided ? "sg-tl-label sg-tl-label-sm"
        : e.imp === 1 ? "sg-tl-label sg-tl-label-big" : "sg-tl-label";
      const t1 = el("text", {
        x: String(lx), y: String(p.y + r + (braided ? 22 : 26)),
        "text-anchor": "middle", class: cls,
      }, g);
      t1.textContent = label;
      const t2 = el("text", {
        x: String(lx), y: String(p.y + r + (braided ? 42 : 50)),
        "text-anchor": "middle", class: "sg-tl-sublabel",
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
    const scale = stream.clientWidth / W;
    stream.scrollTo({ top: Math.max(0, hit[1] * scale - 70), behavior: "smooth" });
  }

  async onClose(): Promise<void> { this.contentEl.empty(); }

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
