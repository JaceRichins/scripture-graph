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
 * woven focus ("time across Nephi") — same engine, different sky.
 *
 * Two things make it FEEL alive rather than merely correct:
 *  · the spine is drawn BY the nodes — each moment steps down from the
 *    last by a compressed measure of the years between them, so empty
 *    millennia read as distance without becoming a void;
 *  · every node and link owns an animated alpha, and hovering sends a
 *    RIPPLE outward hop by hop — the star, then its moments, then what
 *    they touch — each ring fading up a beat later than the last. */
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

/** the look, in one place — every number the sky is drawn with */
const LOOK = {
  linkAlpha: 0.16,          // resting web
  linkAlphaLit: 0.75,       // a link inside the ripple
  linkWidth: 0.9,
  linkWidthLit: 1.7,
  dim: 0.14,                // everything outside the ripple
  haloScale: 2.3,           // soft glow radius, × core radius
  haloAlpha: 0.17,
  labelHalo: "rgba(9,11,20,0.88)",
};

/** how far the ripple travels, and the beat between rings */
const RIPPLE_HOPS = 3;
const HOP_MS = 95;
/** alpha each ring settles at — the wave loses a little light as it goes */
const HOP_ALPHA = [1, 1, 0.82, 0.55];

/** the spine: how far one moment steps down from the moment before it */
const STEP_MIN = 34;        // same year — just room to breathe
const STEP_SPAN = 132;      // added across the whole compressed gap range
const GAP_REF = 2200;       // a gap this size earns nearly the full span

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
  /** anchors the forces pull toward (precomputed once — stable and cheap) */
  ax: number;
  ay: number;
  /** drawn alpha, and where it's heading */
  a: number;
  /** hops from the hovered star; -1 = outside the ripple */
  hop: number;
  /** arrival stagger, ms after the sky is born */
  born: number;
}
interface GLink extends SimulationLinkDatum<GNode> {
  kind: "member" | "narrative";
  a: number;
  hop: number;
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

/** frame-rate independent easing — the same curve at 60fps and 120 */
function ease(cur: number, target: number, dt: number, tau: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / tau));
}

export class TimeGraph {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: Simulation<GNode, GLink> | null = null;
  private nodes: GNode[] = [];
  private links: GLink[] = [];
  private adj = new Map<GNode, GNode[]>();
  /** where the camera IS, and where it's easing to */
  private cam = { x: 0, y: 0, k: 1 };
  private camT = { x: 0, y: 0, k: 1 };
  private vel = { x: 0, y: 0 };
  private raf = 0;
  private simLive = false;
  private animating = true;
  private hover: GNode | null = null;
  private selected: GNode | null = null;
  private rippleAt = 0;
  private t0 = performance.now();
  private lastFrame = performance.now();
  private chipEl: HTMLElement | null = null;
  private worldH = 1000;
  private breaks: [number, number][] = [];   // [year, worldY] spine, node-built
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

  // ------------------------------------------------------------- the spine

  /** Time drawn BY the nodes: each moment steps down from the one before
   * it by a compressed measure of the years between — so a 2,000-year
   * silence reads as real distance without becoming an empty scroll, and
   * a crowded decade still gets room to breathe. */
  private buildSpine(events: TimelineEvent[]): void {
    const years = [...new Set(events.map(e => e.y0))].sort((a, b) => a - b);
    this.breaks = [];
    let pos = 70;
    let prev: number | null = null;
    for (const y of years) {
      if (prev !== null) {
        const gap = y - prev;
        // log compression: gaps grow, but ever more gently
        const t = Math.log1p(gap) / Math.log1p(GAP_REF);
        pos += STEP_MIN + STEP_SPAN * Math.min(1, t);
      }
      this.breaks.push([y, pos]);
      prev = y;
    }
    if (!this.breaks.length) this.breaks.push([0, pos]);
    this.worldH = pos + 90;
  }

  private yForYear(year: number): number {
    const b = this.breaks;
    if (!b.length) return 0;
    if (year <= b[0]![0]) return b[0]![1];
    for (let i = 0; i + 1 < b.length; i++) {
      const [y0, p0] = b[i]!, [y1, p1] = b[i + 1]!;
      if (year <= y1) {
        return y1 === y0 ? p0 : p0 + ((year - y0) / (y1 - y0)) * (p1 - p0);
      }
    }
    return b[b.length - 1]![1];
  }

  // ------------------------------------------------------------- the graph

  /** events pinned to their years; every person/place/thing ONE shared
   * node, spring-tied to each moment it touches */
  private buildGraph(): void {
    const { events, focuses, laneF } = this.scope;
    this.buildSpine(events);

    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const byId = new Map<string, GNode>();
    const entity = new Map<string, GNode>();
    const evsOf = new Map<GNode, GNode[]>();
    const focusOf = (kind: SubjectKind, name: string) =>
      focuses.find(f => f.kind === kind && f.name === name) ?? null;
    let seq = 0;

    for (const ev of events) {
      const mid = (ev.y0 + ev.y1) / 2;
      const laneX = (laneF[ev.lane] ?? 0.5) * WORLD_W;
      const py = this.yForYear(mid);
      const n: GNode = {
        id: `e:${ev.id}`, type: "event", ev,
        label: ev.t,
        color: this.scope.laneColor[ev.lane] ?? "#9aa7c7",
        r: ev.imp === 1 ? 9 : ev.imp === 2 ? 7 : 5.5,
        deg: 0, ax: laneX, ay: py,
        a: 0, hop: -1, born: seq++ * 3,
        x: laneX + (Math.random() - 0.5) * 60,
        fy: py, y: py,
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
              r: 4, deg: 0, ax: laneX, ay: py,
              a: 0, hop: -1, born: seq++ * 3,
              x: (n.x ?? 0) + (Math.random() - 0.5) * 80,
              y: py + (Math.random() - 0.5) * 80,
            };
            const seat = remembered.get(sat.id);
            if (seat) { sat.x = seat.x; sat.y = seat.y; }
            entity.set(key, sat);
            evsOf.set(sat, []);
            nodes.push(sat);
          }
          evsOf.get(sat)!.push(n);
          sat.deg++;
          n.deg++;
          links.push({ source: n, target: sat, kind: "member", a: 0, hop: -1 });
        }
      }
    }
    // an entity belongs where its moments are: the mean of the lanes and
    // years it touches — computed ONCE, then the springs do the rest
    for (const [sat, evs] of evsOf) {
      let sx = 0, sy = 0;
      for (const e of evs) { sx += e.ax; sy += e.ay; }
      sat.ax = evs.length ? sx / evs.length : WORLD_W / 2;
      sat.ay = evs.length ? sy / evs.length : this.worldH / 2;
      // entities grow with their gravity — the graph's size-by-connections
      sat.r = 4 + Math.min(9, sat.deg * 1.1) + (sat.accent ? 1.5 : 0);
    }
    // the cross-hemisphere story arcs, faint and dashed like memory
    for (const [a, b] of this.scope.narrative) {
      const na = byId.get(a), nb = byId.get(b);
      if (na && nb) links.push({ source: na, target: nb, kind: "narrative", a: 0, hop: -1 });
    }
    this.nodes = nodes;
    this.links = links;
    // adjacency once — the ripple walks this, never the link list
    for (const n of nodes) this.adj.set(n, []);
    for (const l of links) {
      const s = l.source as GNode, t = l.target as GNode;
      this.adj.get(s)!.push(t);
      this.adj.get(t)!.push(s);
    }
  }

  private startSim(): void {
    this.sim = forceSimulation<GNode>(this.nodes)
      .force("link", forceLink<GNode, GLink>(this.links)
        .distance(l => l.kind === "member" ? 46 : 170)
        .strength(l => l.kind === "member" ? 0.5 : 0.04))
      .force("charge", forceManyBody<GNode>().strength(-150).distanceMax(340))
      .force("collide", forceCollide<GNode>(n => n.r + 4).strength(0.8))
      .force("x", forceX<GNode>(n => n.ax)
        .strength(n => n.type === "event" ? 0.14 : 0.035))
      // events never leave their year; entities drift toward the middle of
      // their own span in time and let the springs argue from there
      .force("y", forceY<GNode>(n => n.ay)
        .strength(n => n.type === "event" ? 0 : 0.06))
      .velocityDecay(0.34)
      .alphaDecay(0.024)
      .alphaMin(0.004);
    // WE own the clock: d3's own timer would race our frame loop and the
    // motion would judder. Stop it and step the sim once per painted frame.
    this.sim.stop();
    this.simLive = true;
  }

  private reheat(target = 0.25): void {
    if (!this.sim) return;
    this.sim.alphaTarget(target);
    if (this.sim.alpha() < 0.2) this.sim.alpha(0.2);
    this.simLive = true;
  }

  private cool(): void {
    this.sim?.alphaTarget(0);
  }

  // ------------------------------------------------------------ the ripple

  /** hover a star and light spreads outward hop by hop: the star, then
   * the moments it belongs to, then who else stood there — each ring a
   * beat behind the last, everything else falling back into the dark */
  private setRipple(lit: GNode | null): void {
    for (const n of this.nodes) n.hop = -1;
    for (const l of this.links) l.hop = -1;
    if (lit) {
      lit.hop = 0;
      let front = [lit];
      for (let d = 1; d <= RIPPLE_HOPS && front.length; d++) {
        const next: GNode[] = [];
        for (const n of front) {
          for (const m of this.adj.get(n) ?? []) {
            if (m.hop === -1) { m.hop = d; next.push(m); }
          }
        }
        front = next;
      }
      for (const l of this.links) {
        const s = l.source as GNode, t = l.target as GNode;
        // a link belongs to the ring of its FARTHER end — so the wave
        // travels along the threads, not ahead of them
        if (s.hop >= 0 && t.hop >= 0) l.hop = Math.max(s.hop, t.hop);
      }
    }
    this.rippleAt = performance.now();
    this.animating = true;
  }

  /** walk every alpha one frame toward where it belongs */
  private animate(now: number, dt: number): void {
    const lit = this.selected ?? this.hover;
    const since = now - this.rippleAt;
    const age = now - this.t0;
    let moving = false;
    const step = (cur: number, target: number, delay: number): number => {
      if (since < delay) return cur;
      const v = ease(cur, target, dt, 105);
      if (Math.abs(target - v) > 0.004) moving = true;
      return Math.abs(target - v) < 0.004 ? target : v;
    };
    for (const n of this.nodes) {
      // the sky is born a star at a time, top of the story downward
      if (age < n.born) { moving = true; continue; }
      const target = !lit ? 1
        : n.hop < 0 ? LOOK.dim
          : HOP_ALPHA[Math.min(n.hop, HOP_ALPHA.length - 1)]!;
      // brightening waits its turn; falling dark happens at once
      const delay = lit && n.hop > 0 ? n.hop * HOP_MS : 0;
      n.a = step(n.a, target, delay);
    }
    for (const l of this.links) {
      const target = !lit ? LOOK.linkAlpha
        : l.hop < 0 ? LOOK.dim * 0.35
          : LOOK.linkAlphaLit * (HOP_ALPHA[Math.min(l.hop, HOP_ALPHA.length - 1)] ?? 1);
      const delay = lit && l.hop > 0 ? (l.hop - 0.4) * HOP_MS : 0;
      l.a = step(l.a, target, Math.max(0, delay));
    }
    // the camera glides; a released drag keeps coasting
    if (!this.panning && (Math.abs(this.vel.x) > 0.04 || Math.abs(this.vel.y) > 0.04)) {
      this.camT.x += this.vel.x;
      this.camT.y += this.vel.y;
      this.vel.x *= 0.93;
      this.vel.y *= 0.93;
      moving = true;
    }
    for (const key of ["x", "y", "k"] as const) {
      const d = this.camT[key] - this.cam[key];
      if (Math.abs(d) > (key === "k" ? 0.0004 : 0.06)) {
        this.cam[key] = ease(this.cam[key], this.camT[key], dt, 70);
        moving = true;
      } else {
        this.cam[key] = this.camT[key];
      }
    }
    this.animating = moving;
  }

  // ------------------------------------------------------------ the camera

  private fitCamera(): void {
    const w = this.host.clientWidth || 360;
    const k = Math.max(0.3, Math.min(1.4, (w * 0.94) / WORLD_W));
    const first = this.nodes.find(n => n.type === "event");
    this.camT = {
      k, x: (w - WORLD_W * k) / 2,
      y: 46 - ((first?.fy ?? 0) - 60) * k,
    };
    this.cam = { ...this.camT };
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.cam.x) / this.cam.k, y: (py - this.cam.y) / this.cam.k };
  }

  // -------------------------------------------------------------- the loop

  private loop(): void {
    const step = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(48, now - this.lastFrame);
      this.lastFrame = now;
      if (this.simLive && this.sim) {
        this.sim.tick();
        if (this.sim.alpha() < this.sim.alphaMin()) this.simLive = false;
      }
      this.animate(now, dt);
      if (this.simLive || this.animating || this.dragging) this.draw();
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

    if (this.nodes.length > NODE_BUDGET) {
      ctx.fillStyle = "rgba(220,228,255,0.75)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Too many stars for one sky — narrow the filters above.", w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);

    // eras as soft washes behind everything, placed on the node-built spine
    const eras = this.scope.eras;
    for (let i = 0; i < eras.length; i++) {
      const era = eras[i]!;
      const y0 = this.yForYear(era.y);
      const y1 = i + 1 < eras.length ? this.yForYear(eras[i + 1]!.y) : this.worldH;
      ctx.fillStyle = era.tint;
      ctx.fillRect(-2000, y0, 5000, y1 - y0);
      ctx.fillStyle = "rgba(235,240,255,0.045)";
      ctx.font = `700 ${Math.min(70, 26 / Math.min(1, k))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(era.label.toUpperCase(), WORLD_W / 2, y0 + 46);
    }
    // the years themselves, ticking down the left margin
    ctx.textAlign = "left";
    ctx.font = `600 ${11 / Math.min(1, k)}px sans-serif`;
    let lastTickY = -1e9;
    for (const [year, py] of this.breaks) {
      if (py - lastTickY < 46 / k) continue;
      lastTickY = py;
      ctx.strokeStyle = "rgba(150,168,205,0.07)";
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      ctx.moveTo(-400, py);
      ctx.lineTo(WORLD_W + 400, py);
      ctx.stroke();
      ctx.fillStyle = "rgba(190,204,236,0.3)";
      ctx.fillText(yearStr(year), 14, py - 4);
    }

    // edges first — the web beneath the stars
    for (const l of this.links) {
      if (l.a < 0.012) continue;
      const s = l.source as GNode, t = l.target as GNode;
      const inRipple = l.hop >= 0;
      if (l.kind === "narrative") {
        ctx.strokeStyle = `rgba(150,170,220,${l.a * 0.8})`;
        ctx.setLineDash([5 / k, 6 / k]);
      } else {
        const accent = s.accent ?? t.accent;
        const hue = inRipple
          ? ((this.selected ?? this.hover)?.color ?? accent ?? "#9fb2dd")
          : accent ?? "#96a8cd";
        ctx.strokeStyle = this.rgba(hue, l.a);
        ctx.setLineDash([]);
      }
      ctx.lineWidth = (inRipple ? LOOK.linkWidthLit : LOOK.linkWidth) / k;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // stars: soft halo under a bright core — the graph's glow, hand-mixed
    for (const n of this.nodes) {
      if (n.a < 0.012) continue;
      const x = n.x ?? 0, y = n.y ?? 0;
      ctx.fillStyle = this.rgba(n.color, LOOK.haloAlpha * n.a);
      ctx.beginPath();
      ctx.arc(x, y, n.r * LOOK.haloScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.rgba(n.color, n.a);
      ctx.beginPath();
      ctx.arc(x, y, n.r, 0, Math.PI * 2);
      ctx.fill();
      if (n === this.selected) {
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * n.a})`;
        ctx.lineWidth = 1.6 / k;
        ctx.beginPath();
        ctx.arc(x, y, n.r + 4 / k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // labels bloom with zoom — FADED in, never popped — and drawn at screen
    // size so they stay crisp however far the sky is pushed away
    ctx.textAlign = "left";
    for (const n of this.nodes) {
      const la = this.labelAlpha(n, k) * n.a;
      if (la < 0.04) continue;
      const sx = (n.x ?? 0) * k + this.cam.x + (n.r + 6) * k;
      const sy = (n.y ?? 0) * k + this.cam.y + 4;
      if (sx < -140 || sx > w + 20 || sy < -20 || sy > h + 20) continue;
      const big = n.type === "event" && n.ev!.imp === 1;
      ctx.font = `${big ? 700 : 500} ${big ? 12.5 : 11}px sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = LOOK.labelHalo;
      ctx.globalAlpha = la;
      ctx.strokeText(n.label, sx, sy);
      ctx.fillStyle = n.hop === 0 ? "#ffffff"
        : n.type === "entity" ? this.rgba(n.color, 0.95) : "rgba(228,234,250,0.92)";
      ctx.fillText(n.label, sx, sy);
      ctx.globalAlpha = 1;
    }
  }

  /** how loudly a star says its name: the ripple's inner rings always
   * speak, everything else rises with the zoom across a soft window */
  private labelAlpha(n: GNode, k: number): number {
    if (n.hop === 0) return 1;
    if (n.hop === 1) return 0.95;
    const gate = n.type === "event"
      ? (n.ev!.imp === 1 ? 0.42 : n.ev!.imp === 2 ? 0.62 : 1.0)
      : n.deg >= 4 ? 0.55 : 0.95;
    return Math.max(0, Math.min(1, (k - gate) / 0.22));
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
    this.ro = new ResizeObserver(() => { this.animating = true; });
    this.ro.observe(this.host);
    c.addEventListener("wheel", ev => {
      ev.preventDefault();
      this.zoomAt(ev.offsetX, ev.offsetY, Math.exp(-ev.deltaY * 0.0016));
    }, { passive: false });
    c.addEventListener("pointerdown", ev => {
      c.setPointerCapture(ev.pointerId);
      this.pointers.set(ev.pointerId, { x: ev.offsetX, y: ev.offsetY });
      this.moved = false;
      this.vel = { x: 0, y: 0 };
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
        this.hoverNode(hit);
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
        this.animating = true;
        return;
      }
      if (this.panning) {
        const dx = ev.offsetX - this.last.x, dy = ev.offsetY - this.last.y;
        this.camT.x += dx; this.camT.y += dy;
        this.cam.x += dx; this.cam.y += dy;     // the drag itself never lags
        this.vel = { x: dx * 0.6 + this.vel.x * 0.4, y: dy * 0.6 + this.vel.y * 0.4 };
        this.last = { x: ev.offsetX, y: ev.offsetY };
        this.moved = true;
        this.animating = true;
        return;
      }
      this.hoverNode(this.nodeAt(ev.offsetX, ev.offsetY));
    });
    c.addEventListener("pointerleave", () => {
      if (!this.dragging && !this.panning) this.hoverNode(null);
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
        if (!this.moved) this.select(n); else this.hoverNode(null);
        return;
      }
      const wasPan = this.panning;
      this.panning = false;
      if (!this.moved && wasPan) this.select(null);
    };
    c.addEventListener("pointerup", release);
    c.addEventListener("pointercancel", release);
  }

  private hoverNode(n: GNode | null): void {
    if (n === this.hover) return;
    this.hover = n;
    this.canvas.style.cursor = n ? "pointer" : "default";
    if (!this.selected) this.setRipple(n);
  }

  private zoomAt(px: number, py: number, factor: number): void {
    const k1 = Math.max(0.22, Math.min(3.2, this.camT.k * factor));
    // anchor on the world point under the finger, in CAMERA-TARGET space
    const wx = (px - this.camT.x) / this.camT.k;
    const wy = (py - this.camT.y) / this.camT.k;
    this.camT.k = k1;
    this.camT.x = px - wx * k1;
    this.camT.y = py - wy * k1;
    this.animating = true;
  }

  // ------------------------------------------------------- chip and legend

  /** tap a star and it introduces itself — with doors deeper in */
  private select(n: GNode | null): void {
    this.selected = n;
    this.setRipple(n ?? this.hover);
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
