/** 🌌 The constellation time-graph — Obsidian's neural graph feel, pinned
 * to real time.
 *
 * A live force simulation (d3-force — the same physics family the app's
 * own graph runs) rendered to a pan/zoom canvas that copies the graph's
 * visual language: dark field, glowing dots, alpha edges, springy drag,
 * labels that bloom as you zoom. The one law the physics cannot break is
 * TIME: every event node is pinned to its year on the vertical spine (it
 * can drift sideways, never off its date). People, places and things are
 * ONE node each — free-floating, spring-tied to every event they touch —
 * so Jerusalem hangs as a single glow with threads reaching down the
 * centuries. Scope comes from the caller: the whole story, a lane, or a
 * woven focus ("time across Nephi") — same engine, different sky. */
import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation, type SimulationLinkDatum, type SimulationNodeDatum,
} from "d3-force";
import { type SubjectKind, type TimelineEvent } from "./timelineView";

/** the group colors — the SAME palette the Graphs shelf presets wear, so
 * both surfaces speak one color language */
const KIND_COLOR: Record<SubjectKind, string> = {
  people: "#f0b884", places: "#8fd0f4", things: "#c9b8ff",
};
const KIND_EMOJI: Record<SubjectKind, string> = {
  people: "🧑", places: "🗺", things: "📦",
};

const WORLD_W = 1100;             // world units across; camera does the rest
const NODE_BUDGET = 1200;         // past this, honesty beats heroics

interface GNode extends SimulationNodeDatum {
  id: string;
  type: "event" | "entity";
  label: string;
  color: string;
  r: number;
  deg: number;
  ev?: TimelineEvent;
  kind?: SubjectKind;
  accent?: string;                // a focused subject wears its thread color
}
interface GLink extends SimulationLinkDatum<GNode> {
  kind: "member" | "narrative";
}

export interface TimeGraphScope {
  events: TimelineEvent[];
  /** focused subjects, each with its thread accent (may be a CSS var()) */
  focuses: { kind: SubjectKind; name: string; accent: string }[];
  narrative: [string, string][];
  eras: { label: string; y: number; tint: string }[];
  laneColor: Record<string, string>;
  laneF: Record<string, number>;
}
export interface TimeGraphCallbacks {
  onFocusSubject: (s: { kind: SubjectKind; name: string }) => void;
  onOpenEntity: (name: string) => void;
  onOpenChapter: (title: string) => void;
}

/** layouts survive a re-mount (rotation, filter tweak) — the sky doesn't
 * reshuffle every time the pane breathes */
const remembered = new Map<string, { x: number; y: number }>();

/** "var(--interactive-accent)" is CSS-speak; canvas needs the real color */
function solidColor(c: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(c);
  if (!m) return c;
  const v = getComputedStyle(document.body).getPropertyValue(m[1]!).trim();
  return v || "#7c6cff";
}

function yearStr(y: number): string {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}

export class TimeGraph {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation<GNode, GLink> | null = null;
  private nodes: GNode[] = [];
  private links: GLink[] = [];
  private cam = { x: 0, y: 0, k: 1 };
  private raf = 0;
  private simLive = false;
  private needsDraw = true;
  private hover: GNode | null = null;
  private selected: GNode | null = null;
  private chipEl: HTMLElement | null = null;
  private worldH = 1000;
  private breaks: [number, number][] = [];   // [year, worldY] piecewise spine
  private disposed = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private dragging: GNode | null = null;
  private panning = false;
  private moved = false;
  private last = { x: 0, y: 0 };
  private ro: ResizeObserver | null = null;

  constructor(private host: HTMLElement, private scope: TimeGraphScope,
    private cbs: TimeGraphCallbacks) {
    this.canvas = host.createEl("canvas", { cls: "sg-tg-canvas" });
    this.ctx = this.canvas.getContext("2d")!;
    this.buildGraph();
    this.buildLegend();
    this.buildHint();
    this.fitCamera();
    this.attach();
    if (this.nodes.length && this.nodes.length <= NODE_BUDGET) this.startSim();
    this.loop();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.sim?.stop();
    this.ro?.disconnect();
    for (const n of this.nodes) {
      remembered.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }
    this.host.empty();
  }

  // ------------------------------------------------------------- the graph

  /** events pinned to their years; every person/place/thing ONE shared
   * node, spring-tied to each moment it touches */
  private buildGraph(): void {
    const { events, focuses, laneF } = this.scope;
    // the spine: each era slab gets height by how much lives inside it —
    // compressed empty millennia, room where history crowds
    const eras = [...this.scope.eras].sort((a, b) => a.y - b.y);
    const END_Y = 2100;
    let acc = 40;
    this.breaks = [];
    for (let i = 0; i < eras.length; i++) {
      const y0 = eras[i]!.y;
      const y1 = i + 1 < eras.length ? eras[i + 1]!.y : END_Y;
      const inside = events.filter(e => e.y0 >= y0 && e.y0 < y1).length;
      this.breaks.push([y0, acc]);
      acc += Math.max(150, inside * 58);
    }
    this.breaks.push([END_Y, acc]);
    this.worldH = acc + 60;

    const yFor = (year: number): number => this.yForYear(year);
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const byId = new Map<string, GNode>();
    const entity = new Map<string, GNode>();
    const focusOf = (kind: SubjectKind, name: string) =>
      focuses.find(f => f.kind === kind && f.name === name) ?? null;

    for (const ev of events) {
      const mid = (ev.y0 + ev.y1) / 2;
      const n: GNode = {
        id: `e:${ev.id}`, type: "event", ev,
        label: ev.t,
        color: this.scope.laneColor[ev.lane] ?? "#9aa7c7",
        r: ev.imp === 1 ? 9 : ev.imp === 2 ? 7 : 5.5,
        deg: 0,
        x: (laneF[ev.lane] ?? 0.5) * WORLD_W + (Math.random() - 0.5) * 60,
        fy: yFor(mid),
        y: yFor(mid),
      };
      const kept = remembered.get(n.id);
      if (kept) n.x = kept.x;
      byId.set(ev.id, n);
      nodes.push(n);
      const kinds: SubjectKind[] = ["people", "places", "things"];
      for (const kind of kinds) {
        for (const name of ev[kind] ?? []) {
          const key = `${kind}:${name}`;
          let sat = entity.get(key);
          if (!sat) {
            const f = focusOf(kind, name);
            sat = {
              id: `s:${key}`, type: "entity", kind, label: name,
              color: f ? solidColor(f.accent) : KIND_COLOR[kind],
              accent: f ? solidColor(f.accent) : undefined,
              r: 4, deg: 0,
              x: (n.x ?? 0) + (Math.random() - 0.5) * 80,
              y: (n.y ?? 0) + (Math.random() - 0.5) * 80,
            };
            const seat = remembered.get(sat.id);
            if (seat) { sat.x = seat.x; sat.y = seat.y; }
            entity.set(key, sat);
            nodes.push(sat);
          }
          sat.deg++;
          n.deg++;
          links.push({ source: n, target: sat, kind: "member" });
        }
      }
    }
    // entities grow with their gravity — the graph's size-by-connections
    for (const sat of entity.values()) {
      sat.r = 4 + Math.min(9, sat.deg * 1.1) + (sat.accent ? 1.5 : 0);
    }
    // the cross-hemisphere story arcs, faint and dashed like memory
    for (const [a, b] of this.scope.narrative) {
      const na = byId.get(a), nb = byId.get(b);
      if (na && nb) links.push({ source: na, target: nb, kind: "narrative" });
    }
    this.nodes = nodes;
    this.links = links;
  }

  private yForYear(year: number): number {
    const b = this.breaks;
    if (!b.length) return 0;
    if (year <= b[0]![0]) return b[0]![1];
    for (let i = 0; i + 1 < b.length; i++) {
      const [y0, p0] = b[i]!, [y1, p1] = b[i + 1]!;
      if (year <= y1) return p0 + ((year - y0) / (y1 - y0)) * (p1 - p0);
    }
    return b[b.length - 1]![1];
  }

  private startSim(): void {
    const { laneF } = this.scope;
    const meanEventX = (n: GNode): number => {
      let sx = 0, c = 0;
      for (const l of this.links) {
        if (l.kind !== "member") continue;
        const s = l.source as GNode, t = l.target as GNode;
        if (t === n) { sx += s.x ?? 0; c++; }
      }
      return c ? sx / c : WORLD_W / 2;
    };
    this.sim = forceSimulation<GNode>(this.nodes)
      .force("link", forceLink<GNode, GLink>(this.links)
        .distance(l => l.kind === "member" ? 46 : 170)
        .strength(l => l.kind === "member" ? 0.5 : 0.04))
      .force("charge", forceManyBody<GNode>().strength(-150).distanceMax(340))
      .force("collide", forceCollide<GNode>(n => n.r + 4).strength(0.8))
      .force("x", forceX<GNode>(n => n.type === "event"
        ? (laneF[n.ev!.lane] ?? 0.5) * WORLD_W
        : meanEventX(n)).strength(n => n.type === "event" ? 0.14 : 0.03))
      // entities are pulled gently toward the center of their moments in
      // time — the springs decide the rest; events never leave their year
      .force("y", forceY<GNode>(n => {
        if (n.type === "event") return n.fy ?? 0;
        let sy = 0, c = 0;
        for (const l of this.links) {
          if (l.kind !== "member") continue;
          if ((l.target as GNode) === n) { sy += (l.source as GNode).fy ?? 0; c++; }
        }
        return c ? sy / c : this.worldH / 2;
      }).strength(n => n.type === "event" ? 0 : 0.05))
      .velocityDecay(0.32)
      .alphaDecay(0.028)
      .alphaMin(0.004)
      .on("tick", () => { this.needsDraw = true; })
      .on("end", () => { this.simLive = false; });
    this.simLive = true;
  }

  private reheat(target = 0.25): void {
    if (!this.sim) return;
    this.simLive = true;
    this.sim.alphaTarget(target).restart();
  }

  private cool(): void {
    this.sim?.alphaTarget(0);
  }

  // ------------------------------------------------------------ the camera

  private fitCamera(): void {
    const w = this.host.clientWidth || 360;
    this.cam.k = Math.max(0.3, Math.min(1.4, (w * 0.94) / WORLD_W));
    this.cam.x = (w - WORLD_W * this.cam.k) / 2;
    // arrive at the first visible moment, a breath above it
    const first = this.nodes.find(n => n.type === "event");
    this.cam.y = 46 - ((first?.fy ?? 0) - 60) * this.cam.k;
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.cam.x) / this.cam.k, y: (py - this.cam.y) / this.cam.k };
  }

  // -------------------------------------------------------------- the loop

  private loop(): void {
    const step = () => {
      if (this.disposed) return;
      if (this.simLive || this.needsDraw) {
        this.needsDraw = false;
        this.draw();
      }
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private draw(): void {
    const c = this.canvas, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr; c.height = h * dpr;
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { x: cx, y: cy, k } = this.cam;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);

    if (this.nodes.length > NODE_BUDGET) {
      ctx.restore();
      ctx.fillStyle = "rgba(220,228,255,0.75)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Too many stars for one sky — narrow the filters above.", w / 2, h / 2);
      return;
    }

    // era slabs + watermarks, drawn in world space so they scroll with time
    const eras = this.scope.eras;
    for (let i = 0; i < this.breaks.length - 1; i++) {
      const [, p0] = this.breaks[i]!, [, p1] = this.breaks[i + 1]!;
      const era = eras[i];
      if (!era) continue;
      ctx.fillStyle = era.tint;
      ctx.fillRect(-2000, p0, 5000, p1 - p0);
      ctx.fillStyle = "rgba(235,240,255,0.05)";
      ctx.font = `700 ${Math.min(64, 26 / Math.min(1, k))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(era.label.toUpperCase(), WORLD_W / 2, p0 + 44);
      ctx.fillStyle = "rgba(200,212,240,0.35)";
      ctx.font = `600 ${11 / Math.min(1, k)}px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(yearStr(era.y), 14, p0 + 16);
    }

    const lit = this.selected ?? this.hover;
    const litSet = new Set<GNode>();
    if (lit) {
      litSet.add(lit);
      for (const l of this.links) {
        if (l.kind !== "member") continue;
        const s = l.source as GNode, t = l.target as GNode;
        if (s === lit) litSet.add(t);
        if (t === lit) litSet.add(s);
      }
    }

    // edges first — the web beneath the stars
    for (const l of this.links) {
      const s = l.source as GNode, t = l.target as GNode;
      const touches = lit && (s === lit || t === lit);
      if (l.kind === "narrative") {
        ctx.strokeStyle = "rgba(150,170,220,0.14)";
        ctx.setLineDash([5, 6]);
      } else {
        const accent = (s.accent ?? t.accent);
        const alpha = lit ? (touches ? 0.5 : 0.04) : accent ? 0.3 : 0.14;
        ctx.strokeStyle = touches && lit
          ? this.rgba(lit.color, alpha)
          : accent ? this.rgba(accent, alpha) : `rgba(150,168,205,${alpha})`;
        ctx.setLineDash([]);
      }
      ctx.lineWidth = (touches ? 1.6 : 0.8) / k;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // stars: soft halo under a bright core — the graph's glow, hand-mixed
    for (const n of this.nodes) {
      const dim = lit ? !litSet.has(n) : false;
      const x = n.x ?? 0, y = n.y ?? 0;
      ctx.globalAlpha = dim ? 0.18 : 1;
      ctx.fillStyle = this.rgba(n.color, 0.18);
      ctx.beginPath();
      ctx.arc(x, y, n.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(x, y, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n === this.selected) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.6 / k;
        ctx.beginPath();
        ctx.arc(x, y, n.r + 4 / k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // labels bloom with zoom, drawn at screen size so they stay crisp
    ctx.textAlign = "left";
    for (const n of this.nodes) {
      const isLit = litSet.has(n);
      const show = isLit
        || (n.type === "event" && ((n.ev!.imp <= 2 && k > 0.55) || k > 1.05))
        || (n.type === "entity" && (k > 0.85 || n.deg >= 4) && k > 0.45);
      if (!show) continue;
      const dim = lit ? !isLit : false;
      if (dim) continue;
      const sx = (n.x ?? 0) * k + this.cam.x + (n.r + 6) * k;
      const sy = (n.y ?? 0) * k + this.cam.y + 4;
      if (sx < -140 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
      const big = n.type === "event" && n.ev!.imp === 1;
      ctx.font = `${big ? 700 : 500} ${big ? 12.5 : 11}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(8,10,18,0.85)";
      ctx.strokeText(n.label, sx, sy);
      ctx.fillStyle = isLit ? "#ffffff"
        : n.type === "entity" ? this.rgba(n.color, 0.95) : "rgba(228,234,250,0.92)";
      ctx.fillText(n.label, sx, sy);
    }
  }

  private rgba(hex: string, a: number): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const v = parseInt(m[1]!, 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
  }

  // -------------------------------------------------------- the interaction

  private nodeAt(px: number, py: number): GNode | null {
    const wpt = this.toWorld(px, py);
    const slack = 14 / this.cam.k;      // generous thumbs on phones
    let best: GNode | null = null, bd = Infinity;
    for (const n of this.nodes) {
      const dx = (n.x ?? 0) - wpt.x, dy = (n.y ?? 0) - wpt.y;
      const d = Math.hypot(dx, dy) - n.r;
      if (d < slack && d < bd) { best = n; bd = d; }
    }
    return best;
  }

  private attach(): void {
    const c = this.canvas;
    this.ro = new ResizeObserver(() => { this.needsDraw = true; });
    this.ro.observe(this.host);
    c.addEventListener("wheel", ev => {
      ev.preventDefault();
      const factor = Math.exp(-ev.deltaY * 0.0016);
      this.zoomAt(ev.offsetX, ev.offsetY, factor);
    }, { passive: false });
    c.addEventListener("pointerdown", ev => {
      c.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
      this.moved = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        this.dragging = null;
        this.panning = false;
        return;
      }
      this.last = { x: ev.offsetX, y: ev.offsetY };
      const hit = this.nodeAt(ev.offsetX, ev.offsetY);
      if (hit) {
        this.dragging = hit;
        this.reheat(0.2);
      } else {
        this.panning = true;
      }
    });
    c.addEventListener("pointermove", ev => {
      const p = this.pointers.get(ev.pointerId);
      if (p) { p.x = ev.offsetX; p.y = ev.offsetY; }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.pinchDist > 0) {
          this.zoomAt((a!.x + b!.x) / 2, (a!.y + b!.y) / 2, d / this.pinchDist);
        }
        this.pinchDist = d;
        this.moved = true;
        return;
      }
      if (this.dragging) {
        const wpt = this.toWorld(ev.offsetX, ev.offsetY);
        this.dragging.fx = wpt.x;
        // events stay pinned to their year — the one rule of this sky
        if (this.dragging.type === "entity") this.dragging.fy = wpt.y;
        this.moved = true;
        this.needsDraw = true;
        return;
      }
      if (this.panning) {
        this.cam.x += ev.offsetX - this.last.x;
        this.cam.y += ev.offsetY - this.last.y;
        this.last = { x: ev.offsetX, y: ev.offsetY };
        this.moved = true;
        this.needsDraw = true;
        return;
      }
      const hov = this.nodeAt(ev.offsetX, ev.offsetY);
      if (hov !== this.hover) {
        this.hover = hov;
        c.style.cursor = hov ? "pointer" : "default";
        this.needsDraw = true;
      }
    });
    const release = (ev: PointerEvent) => {
      this.pointers.delete(ev.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (this.dragging) {
        const n = this.dragging;
        this.dragging = null;
        n.fx = undefined;
        if (n.type === "entity") n.fy = undefined;
        this.cool();
        if (!this.moved) this.select(n);
        return;
      }
      const wasPan = this.panning;
      this.panning = false;
      if (!this.moved && wasPan) this.select(null);
    };
    c.addEventListener("pointerup", release);
    c.addEventListener("pointercancel", release);
  }

  private zoomAt(px: number, py: number, factor: number): void {
    const k1 = Math.max(0.22, Math.min(3.2, this.cam.k * factor));
    const wpt = this.toWorld(px, py);
    this.cam.k = k1;
    this.cam.x = px - wpt.x * k1;
    this.cam.y = py - wpt.y * k1;
    this.needsDraw = true;
  }

  // ------------------------------------------------------- chip and legend

  /** tap a star and it introduces itself — with doors deeper in */
  private select(n: GNode | null): void {
    this.selected = n;
    this.needsDraw = true;
    this.chipEl?.remove();
    this.chipEl = null;
    if (!n) return;
    const chip = this.host.createDiv({ cls: "sg-tg-chip" });
    this.chipEl = chip;
    const head = chip.createDiv({ cls: "sg-tg-chip-head" });
    if (n.type === "entity") {
      head.createSpan({ text: `${KIND_EMOJI[n.kind!]} ` });
      head.createSpan({ cls: "sg-tg-chip-name", text: n.label });
      chip.createDiv({
        cls: "sg-tg-chip-sub",
        text: `${n.deg} moment${n.deg === 1 ? "" : "s"} across time`,
      });
      const row = chip.createDiv({ cls: "sg-tg-chip-row" });
      const focus = row.createEl("button", { cls: "sg-tg-chip-btn", text: "🎯 Focus" });
      focus.onclick = () => this.cbs.onFocusSubject({ kind: n.kind!, name: n.label });
      if (n.kind !== "things") {
        const open = row.createEl("button", { cls: "sg-tg-chip-btn", text: "↗ Page" });
        open.onclick = () => this.cbs.onOpenEntity(n.label);
      }
    } else {
      const ev = n.ev!;
      head.createSpan({ cls: "sg-tg-chip-name", text: ev.t });
      const span = ev.y0 === ev.y1 ? yearStr(ev.y0) : `${yearStr(ev.y0)} – ${yearStr(ev.y1)}`;
      chip.createDiv({ cls: "sg-tg-chip-sub", text: `${span} · ${ev.note}` });
      const first = ev.chapters?.[0];
      if (first) {
        const row = chip.createDiv({ cls: "sg-tg-chip-row" });
        const open = row.createEl("button", { cls: "sg-tg-chip-btn", text: `📖 ${first}` });
        open.onclick = () => this.cbs.onOpenChapter(first);
      }
    }
    const x = chip.createEl("button", { cls: "sg-tg-chip-x", text: "✕" });
    x.onclick = () => this.select(null);
  }

  /** the group colors, named — the legend doubles as the promise that both
   * graph surfaces speak the same language */
  private buildLegend(): void {
    const leg = this.host.createDiv({ cls: "sg-tg-legend" });
    const dot = (color: string, label: string) => {
      const d = leg.createSpan({ cls: "sg-tg-leg" });
      d.createSpan({ cls: "sg-tg-leg-dot" }).style.background = color;
      d.createSpan({ text: label });
    };
    dot(KIND_COLOR.people, "People");
    dot(KIND_COLOR.places, "Places");
    dot(KIND_COLOR.things, "Things");
  }

  private buildHint(): void {
    this.host.createDiv({
      cls: "sg-tg-hint",
      text: "drag the sky · pinch or scroll to zoom · tap a star",
    });
  }
}
