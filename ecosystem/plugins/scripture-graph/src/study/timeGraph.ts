/** 🌌 The constellation time-graph — Obsidian's neural graph, pinned to time.
 *
 * The look here is not an impression of Obsidian's graph; it is measured
 * from it. Their renderer was read out of the app bundle and the numbers
 * that matter were copied straight across: nodes size as
 * `clamp(3·√(deg+1), 8, 30)` and scale by √zoom (never linearly); labels
 * hang BELOW their star, centered, with no halo, fading in by
 * `log2(zoom)+1`; links are constant-screen-width straight lines that
 * bleed toward the accent color when lit; everything — alpha AND color —
 * eases by the same 10%-per-frame smoother; unrelated nodes fall to
 * exactly 0.2; the hovered star takes the accent fill and a 1px ring, and
 * its label slides 15px down and burns full bright. Their forces settle
 * over ~5 seconds, so ours do too.
 *
 * What we do NOT copy is the reach: Obsidian's hover stops at one hop.
 * Ours sends a RIPPLE outward — the star, then its moments, then who else
 * stood there — each ring lighting a beat after the last.
 *
 * And the one law their graph never had: TIME. Event nodes are pinned to
 * their year on a spine the nodes themselves draw — each moment steps
 * down from the last by a log-compressed measure of the years between, so
 * empty millennia read as distance without becoming a void. People,
 * places and things are ONE node each, spring-tied to every moment they
 * touch, so Jerusalem hangs as a single glow with threads reaching down
 * the centuries. */
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

/** ── measured from Obsidian's renderer ────────────────────────────────
 * DIM: their `QQ` — what an unrelated node fades to, exactly 0.2.
 * TAU: their `$Q` smoother is `x += (target-x) * 0.1` every frame; at
 *   60fps that is a 158ms time constant, expressed here frame-rate free.
 * ZOOM_TAU: zoom eases at 0.15/frame → ~103ms.
 * Node radius, label size and label fade are their formulas verbatim. */
const DIM = 0.2;
const TAU = 158;
const ZOOM_TAU = 103;
const LINK_ALPHA = 1;          // their line alpha rides colors.line.a
const LINK_WIDTH = 1;          // lineSizeMultiplier — constant SCREEN px
const RING_MIN_PX = 1;
const LABEL_DROP_PX = 15;      // the hovered label's slide, in screen px
const TEXT_FADE_MULT = 0;      // their default textFadeMultiplier

/** how far the ripple travels, and the beat between rings (ours, not
 * theirs — Obsidian's highlight stops at one hop) */
const RIPPLE_HOPS = 3;
const HOP_MS = 95;
const HOP_ALPHA = [1, 1, 0.82, 0.55];

/** the spine: how far one moment steps down from the moment before it */
const STEP_MIN = 46;
const STEP_SPAN = 150;
const GAP_REF = 2200;          // a gap this size earns nearly the full span

const WORLD_W = 1100;
const NODE_BUDGET = 1200;

interface GNode extends SimulationNodeDatum {
  id: string;
  type: "event" | "entity";
  label: string;
  /** the node's own color as an rgb int — what its tint eases toward */
  rgb: number;
  /** the tint actually painted this frame (eases toward rgb, or accent) */
  tint: number;
  size: number;                 // world radius at zoom 1 (their getSize)
  deg: number;
  ev?: TimelineEvent;
  kind?: SubjectKind;
  accent: boolean;              // a focused subject wears its thread color
  ax: number; ay: number;       // force anchors, precomputed once
  a: number;                    // drawn alpha
  hop: number;                  // hops from the hovered star; -1 = outside
  drop: number;                 // label slide, eased
  born: number;
}
interface GLink extends SimulationLinkDatum<GNode> {
  kind: "member" | "narrative";
  a: number;
  tint: number;
  hop: number;
}

export interface TimeGraphScope {
  events: TimelineEvent[];
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

/** layouts survive a re-mount — the sky doesn't reshuffle when the pane
 * breathes */
const remembered = new Map<string, { x: number; y: number }>();

// ---------------------------------------------------------------- color

/** any CSS color → rgb int, by letting the browser normalize it (the
 * theme's vars arrive as hsl(...), which no hand parser should own) */
let probe: CanvasRenderingContext2D | null = null;
function toRGB(css: string, fallback: number): number {
  if (!probe) probe = document.createElement("canvas").getContext("2d");
  if (!probe) return fallback;
  probe.fillStyle = "#000000";
  try { probe.fillStyle = css; } catch { return fallback; }
  const s = probe.fillStyle as string;
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return parseInt(m[1]!, 16);
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(s);
  if (m) return (+m[1]! << 16) | (+m[2]! << 8) | +m[3]!;
  return fallback;
}
function cssVar(name: string, fallback: number): number {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v ? toRGB(v, fallback) : fallback;
}
const rgbaStr = (rgb: number, a: number): string =>
  `rgba(${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255},${a})`;

/** frame-rate independent easing — the same curve at 60fps and 120 */
function ease(cur: number, target: number, dt: number, tau: number): number {
  return cur + (target - cur) * (1 - Math.exp(-dt / tau));
}
/** their ZQ: tints lerp per channel, so the accent BLEEDS in */
function easeRGB(cur: number, target: number, f: number): number {
  const r = ((cur >> 16) & 255) + (((target >> 16) & 255) - ((cur >> 16) & 255)) * f;
  const g = ((cur >> 8) & 255) + (((target >> 8) & 255) - ((cur >> 8) & 255)) * f;
  const b = (cur & 255) + ((target & 255) - (cur & 255)) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
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
  private adj = new Map<GNode, GNode[]>();
  private cam = { x: 0, y: 0, k: 1 };
  private camT = { x: 0, y: 0, k: 1 };
  private vel = { x: 0, y: 0 };
  private col = { line: 0x3f3f3f, text: 0xdadada, accent: 0x8a5cf5, ring: 0xa68af9 };
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
  private breaks: [number, number][] = [];
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
    this.readTheme();
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

  /** the graph's own theme vars — the same ones Obsidian's renderer reads */
  private readTheme(): void {
    this.col = {
      line: cssVar("--graph-line", 0x3f3f3f),
      text: cssVar("--graph-text", cssVar("--text-normal", 0xdadada)),
      accent: cssVar("--interactive-accent", 0x8a5cf5),
      ring: cssVar("--graph-node-focused", cssVar("--text-accent", 0xa68af9)),
    };
  }

  // ------------------------------------------------------------- the spine

  /** Time drawn BY the nodes: each moment steps down from the one before
   * it by a compressed measure of the years between — so a 2,000-year
   * silence reads as real distance without becoming an empty scroll. */
  private buildSpine(events: TimelineEvent[]): void {
    const years = [...new Set(events.map(e => e.y0))].sort((a, b) => a - b);
    this.breaks = [];
    let pos = 70;
    let prev: number | null = null;
    for (const y of years) {
      if (prev !== null) {
        const t = Math.log1p(y - prev) / Math.log1p(GAP_REF);
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

  /** their getSize, verbatim: 3·√(degree+1), floored at 8, capped at 30 */
  private sizeFor(deg: number, boost = 1): number {
    return Math.max(8, Math.min(3 * Math.sqrt(deg + 1) * boost, 30));
  }

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
      const laneX = (laneF[ev.lane] ?? 0.5) * WORLD_W;
      const py = this.yForYear((ev.y0 + ev.y1) / 2);
      const rgb = toRGB(this.scope.laneColor[ev.lane] ?? "#9aa7c7", 0x9aa7c7);
      const n: GNode = {
        id: `e:${ev.id}`, type: "event", ev, label: ev.t,
        rgb, tint: rgb, size: 10, deg: 0, accent: false,
        ax: laneX, ay: py, a: 0, hop: -1, drop: 0, born: seq++ * 3,
        x: laneX + (Math.random() - 0.5) * 60, fy: py, y: py,
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
            const srgb = toRGB(f ? f.accent : KIND_COLOR[kind],
              f ? this.col.accent : 0x8fd0f4);
            sat = {
              id: `s:${key}`, type: "entity", kind, label: name,
              rgb: srgb, tint: srgb, size: 8, deg: 0, accent: !!f,
              ax: laneX, ay: py, a: 0, hop: -1, drop: 0, born: seq++ * 3,
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
          links.push({ source: n, target: sat, kind: "member", a: 0, tint: this.col.line, hop: -1 });
        }
      }
    }
    // events wear their importance; entities grow with their gravity
    for (const n of nodes) {
      if (n.type === "event") {
        const imp = n.ev!.imp;
        n.size = this.sizeFor(n.deg, imp === 1 ? 1.45 : imp === 2 ? 1.15 : 0.95);
      } else {
        n.size = this.sizeFor(n.deg, n.accent ? 1.2 : 1);
      }
    }
    // an entity belongs where its moments are — the mean of the lanes and
    // years it touches, computed ONCE, then the springs argue from there
    for (const [sat, evs] of evsOf) {
      let sx = 0, sy = 0;
      for (const e of evs) { sx += e.ax; sy += e.ay; }
      sat.ax = evs.length ? sx / evs.length : WORLD_W / 2;
      sat.ay = evs.length ? sy / evs.length : this.worldH / 2;
    }
    for (const [a, b] of this.scope.narrative) {
      const na = byId.get(a), nb = byId.get(b);
      if (na && nb) {
        links.push({ source: na, target: nb, kind: "narrative", a: 0, tint: this.col.line, hop: -1 });
      }
    }
    this.nodes = nodes;
    this.links = links;
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
        .distance(l => l.kind === "member" ? 72 : 230)
        .strength(l => l.kind === "member" ? 0.5 : 0.04))
      .force("charge", forceManyBody<GNode>()
        .strength(-260).distanceMin(20).distanceMax(430))
      .force("collide", forceCollide<GNode>(n => n.size + 7).strength(0.6))
      .force("x", forceX<GNode>(n => n.ax)
        .strength(n => n.type === "event" ? 0.14 : 0.035))
      // events never leave their year; entities drift toward the middle of
      // their own span in time and let the springs decide the rest
      .force("y", forceY<GNode>(n => n.ay)
        .strength(n => n.type === "event" ? 0 : 0.06))
      // their settle: velocityDecay 0.4, alphaDecay 0.0228 → ~5s to rest
      .velocityDecay(0.4)
      .alphaDecay(0.0228)
      .alphaMin(0.001);
    // WE own the clock: d3's own timer would race our frame loop and the
    // motion would judder. Stop it, step it once per painted frame.
    this.sim.stop();
    this.simLive = true;
  }

  private reheat(target = 0.3): void {
    if (!this.sim) return;
    this.sim.alphaTarget(target);
    if (this.sim.alpha() < target) this.sim.alpha(target);
    this.simLive = true;
  }

  private cool(): void { this.sim?.alphaTarget(0); }

  // ------------------------------------------------------------ the ripple

  /** hover a star and light spreads outward hop by hop: the star, then
   * the moments it belongs to, then who else stood there — each ring a
   * beat behind the last, everything else falling back to 0.2 */
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
        // a link belongs to the ring of its FARTHER end, so the wave
        // travels ALONG the threads rather than ahead of them
        if (s.hop >= 0 && t.hop >= 0) l.hop = Math.max(s.hop, t.hop);
      }
    }
    this.rippleAt = performance.now();
    this.animating = true;
  }

  private lit(): GNode | null {
    return this.dragging ?? this.selected ?? this.hover;
  }

  /** walk every alpha, tint and camera value one frame toward home */
  private animate(now: number, dt: number): void {
    const lit = this.lit();
    const since = now - this.rippleAt;
    const age = now - this.t0;
    const f = 1 - Math.exp(-dt / TAU);
    let moving = false;
    const step = (cur: number, target: number, delay: number): number => {
      if (since < delay) { moving = true; return cur; }
      const v = ease(cur, target, dt, TAU);
      if (Math.abs(target - v) > 0.004) { moving = true; return v; }
      return target;
    };
    for (const n of this.nodes) {
      if (age < n.born) { moving = true; continue; }
      const target = !lit ? 1
        : n.hop < 0 ? DIM
          : HOP_ALPHA[Math.min(n.hop, HOP_ALPHA.length - 1)]!;
      // brightening waits its turn; falling dark happens at once
      n.a = step(n.a, target, lit && n.hop > 0 ? n.hop * HOP_MS : 0);
      // the hovered star takes the accent fill — bled in, never snapped
      const tgt = n === lit ? this.col.accent : n.rgb;
      if (n.tint !== tgt) {
        n.tint = easeRGB(n.tint, tgt, f);
        moving = true;
      }
      const drop = n === lit ? LABEL_DROP_PX : 0;
      if (Math.abs(n.drop - drop) > 0.2) { n.drop = ease(n.drop, drop, dt, TAU); moving = true; }
      else n.drop = drop;
    }
    for (const l of this.links) {
      const target = !lit ? LINK_ALPHA
        : l.hop < 0 ? DIM
          : LINK_ALPHA * (HOP_ALPHA[Math.min(l.hop, HOP_ALPHA.length - 1)] ?? 1);
      l.a = step(l.a, target, lit && l.hop > 0 ? Math.max(0, (l.hop - 0.4) * HOP_MS) : 0);
      const tgt = l.hop >= 0 && lit ? this.col.accent : this.col.line;
      if (l.tint !== tgt) { l.tint = easeRGB(l.tint, tgt, f); moving = true; }
    }
    // a released drag keeps coasting; the camera glides after it
    if (!this.panning && (Math.abs(this.vel.x) > 0.04 || Math.abs(this.vel.y) > 0.04)) {
      this.camT.x += this.vel.x;
      this.camT.y += this.vel.y;
      this.vel.x *= 0.92;
      this.vel.y *= 0.92;
      moving = true;
    }
    for (const key of ["x", "y", "k"] as const) {
      const tau = key === "k" ? ZOOM_TAU : 70;
      if (Math.abs(this.camT[key] - this.cam[key]) > (key === "k" ? 0.0004 : 0.06)) {
        this.cam[key] = ease(this.cam[key], this.camT[key], dt, tau);
        moving = true;
      } else this.cam[key] = this.camT[key];
    }
    this.animating = moving;
  }

  // ------------------------------------------------------------ the camera

  private fitCamera(): void {
    const w = this.host.clientWidth || 360;
    const k = Math.max(0.3, Math.min(1.4, (w * 0.94) / WORLD_W));
    const first = this.nodes.find(n => n.type === "event");
    this.camT = { k, x: (w - WORLD_W * k) / 2, y: 46 - ((first?.fy ?? 0) - 60) * k };
    this.cam = { ...this.camT };
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.cam.x) / this.cam.k, y: (py - this.cam.y) / this.cam.k };
  }

  /** their nodeScale: world radius = size·√(1/zoom), so on SCREEN a star
   * grows as √zoom — the single biggest reason their graph feels right */
  private get nodeScale(): number { return Math.sqrt(1 / this.cam.k); }

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
    const k = this.cam.k, ns = this.nodeScale;

    if (this.nodes.length > NODE_BUDGET) {
      ctx.fillStyle = "rgba(220,228,255,0.75)";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Too many stars for one sky — narrow the filters above.", w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(this.cam.x, this.cam.y);
    ctx.scale(k, k);

    // eras as soft washes behind everything, on the node-built spine
    const eras = this.scope.eras;
    for (let i = 0; i < eras.length; i++) {
      const era = eras[i]!;
      const y0 = this.yForYear(era.y);
      const y1 = i + 1 < eras.length ? this.yForYear(eras[i + 1]!.y) : this.worldH;
      ctx.fillStyle = era.tint;
      ctx.fillRect(-2000, y0, 5000, y1 - y0);
      ctx.fillStyle = "rgba(235,240,255,0.045)";
      ctx.font = `700 ${Math.min(70, 26 * ns)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(era.label.toUpperCase(), WORLD_W / 2, y0 + 46);
    }
    // the years themselves, ticking down the left margin
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `600 ${11 * ns}px sans-serif`;
    let lastTick = -1e9;
    for (const [year, py] of this.breaks) {
      if (py - lastTick < 46 / k) continue;
      lastTick = py;
      ctx.strokeStyle = rgbaStr(this.col.line, 0.16);
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      ctx.moveTo(-400, py);
      ctx.lineTo(WORLD_W + 400, py);
      ctx.stroke();
      ctx.fillStyle = rgbaStr(this.col.text, 0.3);
      ctx.fillText(yearStr(year), 14, py - 4);
    }

    // links: straight, trimmed to the circles, constant SCREEN width
    ctx.lineWidth = LINK_WIDTH / k;
    for (const l of this.links) {
      if (l.a < 0.012) continue;
      const s = l.source as GNode, t = l.target as GNode;
      const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
      const dx = tx - sx, dy = ty - sy;
      const m = Math.hypot(dx, dy) || 1;
      const r0 = s.size * ns, r1 = t.size * ns;
      if (m <= r0 + r1) continue;
      ctx.strokeStyle = rgbaStr(l.tint, l.a);
      ctx.setLineDash(l.kind === "narrative" ? [5 / k, 6 / k] : []);
      ctx.beginPath();
      ctx.moveTo(sx + (dx / m) * r0, sy + (dy / m) * r0);
      ctx.lineTo(tx - (dx / m) * r1, ty - (dy / m) * r1);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // stars: flat filled circles — Obsidian has no glow, and neither do we
    const lit = this.lit();
    for (const n of this.nodes) {
      if (n.a < 0.012) continue;
      const r = n.size * ns;
      ctx.fillStyle = rgbaStr(n.tint, n.a);
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (n === lit) {
        // their ring: ≥1 screen px, drawn just outside the star
        const lw = Math.max(RING_MIN_PX / k, 1 / (k * ns));
        ctx.strokeStyle = rgbaStr(this.col.ring, n.a);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r + lw / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // labels: BELOW the star, centered, no halo — their layout exactly.
    // textAlpha = clamp(log2(zoom) + 1 − fadeMult, 0, 1); the hovered
    // star's label ignores zoom entirely and burns full bright.
    const textAlpha = Math.max(0, Math.min(1,
      Math.log(k) / Math.LN2 + 1 - TEXT_FADE_MULT));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const n of this.nodes) {
      const la = (n === lit ? 1 : textAlpha * n.a);
      if (la < 0.02) continue;
      const x = n.x ?? 0, y = n.y ?? 0;
      const sx = x * k + this.cam.x, sy = y * k + this.cam.y;
      if (sx < -180 || sx > w + 180 || sy < -40 || sy > h + 60) continue;
      ctx.font = `${(14 + n.size / 4) * ns}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = rgbaStr(n === lit ? this.col.text : n.type === "entity" ? n.rgb : this.col.text, la);
      ctx.fillText(n.label, x, y + (n.size + 5) * ns + n.drop / k);
    }
    ctx.restore();
    ctx.textBaseline = "alphabetic";
  }

  // -------------------------------------------------------- the interaction

  private nodeAt(px: number, py: number): GNode | null {
    const wpt = this.toWorld(px, py);
    const slack = 12 / this.cam.k;
    const ns = this.nodeScale;
    let best: GNode | null = null, bd = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot((n.x ?? 0) - wpt.x, (n.y ?? 0) - wpt.y) - n.size * ns;
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
      const d = ev.deltaMode === 1 ? ev.deltaY * 40
        : ev.deltaMode === 2 ? ev.deltaY * 800 : ev.deltaY;
      this.zoomAt(ev.offsetX, ev.offsetY, Math.pow(1.5, -d / 120));
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
        this.setRipple(hit);      // dragging highlights, as theirs does
        this.reheat(0.3);
      } else this.panning = true;
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
        // events stay pinned to their year — the one law of this sky
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
        if (!this.moved) this.select(n);
        else if (!this.selected) this.setRipple(this.hover);
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

  /** their zoom: eased toward a target, anchored under the finger going
   * in, recentered on the viewport going out */
  private zoomAt(px: number, py: number, factor: number): void {
    const k1 = Math.max(0.12, Math.min(4, this.camT.k * factor));
    const ax = factor >= 1 ? px : this.host.clientWidth / 2;
    const ay = factor >= 1 ? py : this.host.clientHeight / 2;
    const wx = (ax - this.camT.x) / this.camT.k;
    const wy = (ay - this.camT.y) / this.camT.k;
    this.camT.k = k1;
    this.camT.x = ax - wx * k1;
    this.camT.y = ay - wy * k1;
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
