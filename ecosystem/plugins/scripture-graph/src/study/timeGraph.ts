/** 🌌 The constellation — the vault's OWN web, pinned to time.
 *
 * Nothing here is a hand-written edge. The connections are the vault's
 * real `[[wikilinks]]`, read from Obsidian's own `resolvedLinks` index —
 * the same graph its graph view draws. Every page the engine writes, and
 * every link it discovers, changes this sky on the next open. Nodes are
 * real files; their size is their real degree; their color is the folder
 * they live in; the web between them is whatever the vault actually says.
 *
 * The one thing the vault does NOT know is WHEN. That comes from the
 * chronology: curated moments carry years, chapters carry a book year in
 * their own frontmatter, and every other page infers its year by
 * averaging its dated neighbours — so Nephi drifts to ~590 BC because the
 * chapters he is linked from live there. Time propagates ALONG the real
 * links; nothing is placed by hand.
 *
 * The rendering is measured from Obsidian's renderer, not imitated:
 * size = clamp(3·√(deg+1), 8, 30) scaling by √zoom; labels below the star,
 * centered, no halo, fading by log2(zoom)+1; links constant-screen-width
 * and bleeding toward the accent; unrelated nodes at exactly 0.2; alpha
 * and tint both easing on their 10%-per-frame smoother. What we add is
 * reach: their highlight stops at one hop, ours ripples outward three. */
import {
  forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation, type SimulationLinkDatum, type SimulationNodeDatum,
} from "d3-force";
import { TFile, type App } from "obsidian";
import { type TimelineEvent } from "./timelineView";

/** color by FOLDER — the vault's own shelves, so new folders simply
 * arrive wearing the palette the Graphs shelf already speaks */
const FOLDER_TINT: [string, string][] = [
  ["AI Library/03 People", "#f0b884"],
  ["AI Library/04 Places", "#8fd0f4"],
  ["AI Library/02 Gospel Topics", "#79d2c3"],
  ["AI Library/05 Events", "#e79ec4"],
  ["AI Library/06 Doctrines", "#c9b8ff"],
  ["AI Library/80 Bible Dictionary", "#b9c6e8"],
  ["AI Library/10 General Conference", "#d9c07a"],
  ["AI Library/40 Evidence", "#93d3a2"],
  ["AI Library/30 Church History", "#e0a887"],
  ["AI Library/01 Scriptures", "#8ec7f0"],
  ["Library/", "#c9b8ff"],
];
const FALLBACK_TINT = "#9aa7c7";

/** ── measured from Obsidian's renderer ─────────────────────────────── */
const DIM = 0.2;                 // their QQ
const TAU = 158;                 // their $Q smoother, as a time constant
const ZOOM_TAU = 103;
const LINK_WIDTH = 1;            // constant SCREEN px
const RING_MIN_PX = 1;
const LABEL_DROP_PX = 15;
const TEXT_FADE_MULT = 0;

/** ours, not theirs — the ripple reaches where their highlight stops */
const RIPPLE_HOPS = 3;
const HOP_MS = 95;
const HOP_ALPHA = [1, 1, 0.82, 0.55];

/** the spine: how far one moment steps down from the one before it */
const STEP_MIN = 32;
const STEP_SPAN = 104;
const GAP_REF = 2200;

const WORLD_W = 1700;
/** how big a sky one device can hold — the rest is trimmed, and said so */
const MAX_NODES = 640;
const MAX_NODES_MOBILE = 380;

interface GNode extends SimulationNodeDatum {
  id: string;
  type: "event" | "file";
  path?: string;                  // real vault file, for files
  label: string;
  rgb: number;
  tint: number;
  size: number;
  deg: number;
  ev?: TimelineEvent;
  accent: boolean;
  /** the year this page sits at — known, inferred, or null */
  year: number | null;
  known: boolean;
  ax: number; ay: number;
  /** is ax a real lane, or still waiting to be inferred? */
  axK: boolean;
  a: number;
  hop: number;
  drop: number;
  born: number;
}
interface GLink extends SimulationLinkDatum<GNode> {
  a: number;
  tint: number;
  hop: number;
}

export interface TimeGraphScope {
  app: App;
  /** the visible moments — the chronology, and the only source of years */
  events: TimelineEvent[];
  /** book slug → year, from the dataset (chapters date themselves by it) */
  bookYears: Record<string, number>;
  focuses: { kind: string; name: string; accent: string }[];
  eras: { label: string; y: number; tint: string }[];
  laneColor: Record<string, string>;
  laneF: Record<string, number>;
}
export interface TimeGraphCallbacks {
  onOpenPath: (path: string) => void;
  onOpenLink: (linkText: string) => void;
}

const remembered = new Map<string, { x: number; y: number }>();

// ---------------------------------------------------------------- color

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
const baseName = (p: string): string =>
  p.slice(p.lastIndexOf("/") + 1).replace(/\.md$/i, "");

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
  private trimmed = 0;
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
    if (this.nodes.length) this.startSim();
    this.loop();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.sim?.stop();
    this.ro?.disconnect();
    for (const n of this.nodes) remembered.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    this.host.empty();
  }

  private readTheme(): void {
    this.col = {
      line: cssVar("--graph-line", 0x3f3f3f),
      text: cssVar("--graph-text", cssVar("--text-normal", 0xdadada)),
      accent: cssVar("--interactive-accent", 0x8a5cf5),
      ring: cssVar("--graph-node-focused", cssVar("--text-accent", 0xa68af9)),
    };
  }

  // ------------------------------------------------------------- the spine

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

  private tintFor(path: string): string {
    for (const [prefix, hex] of FOLDER_TINT) if (path.startsWith(prefix)) return hex;
    return FALLBACK_TINT;
  }

  /** a chapter dates ITSELF: its frontmatter carries `slug: gen-1`, and the
   * dataset carries the year of `gen` — no table of ours in between */
  private yearOfFile(path: string): number | null {
    const fm = this.scope.app.metadataCache.getCache(path)?.frontmatter as
      { slug?: unknown } | undefined;
    const slug = typeof fm?.slug === "string" ? fm.slug : null;
    if (!slug) return null;
    const book = slug.replace(/-\d+$/, "");
    const y = this.scope.bookYears[book];
    return typeof y === "number" ? y : null;
  }

  private buildGraph(): void {
    const app = this.scope.app;
    const { events, laneF } = this.scope;
    this.buildSpine(events);
    const budget = (window.innerWidth < 700 ? MAX_NODES_MOBILE : MAX_NODES);

    // ---- the vault's real link graph, both directions ------------------
    const resolved = app.metadataCache.resolvedLinks ?? {};
    const back = new Map<string, Set<string>>();
    for (const src of Object.keys(resolved)) {
      for (const dst of Object.keys(resolved[src] ?? {})) {
        let s = back.get(dst);
        if (!s) { s = new Set(); back.set(dst, s); }
        s.add(src);
      }
    }
    const neighboursOf = (p: string): string[] => [
      ...Object.keys(resolved[p] ?? {}),
      ...(back.get(p) ?? []),
    ];

    // ---- seeds: the pages the visible moments actually cite ------------
    const seeds = new Map<string, TimelineEvent[]>();
    for (const ev of events) {
      for (const title of ev.chapters ?? []) {
        const f = app.metadataCache.getFirstLinkpathDest(title, "");
        if (!(f instanceof TFile)) continue;
        const list = seeds.get(f.path) ?? [];
        list.push(ev);
        seeds.set(f.path, list);
      }
    }

    // ---- grow OUTWARD along real links, keeping the best-connected ----
    // a page's score is how many distinct seeds reach it: the pages the
    // story leans on most are the ones that make the cut
    const score = new Map<string, number>();
    const bump = (p: string, by = 1) => score.set(p, (score.get(p) ?? 0) + by);
    let frontier = [...seeds.keys()];
    const seen = new Set(frontier);
    for (let hop = 0; hop < 2 && frontier.length; hop++) {
      const next: string[] = [];
      for (const p of frontier) {
        for (const q of neighboursOf(p)) {
          if (!q.endsWith(".md")) continue;
          bump(q, hop === 0 ? 2 : 1);
          if (!seen.has(q)) { seen.add(q); next.push(q); }
        }
      }
      frontier = next;
    }
    const room = Math.max(0, budget - seeds.size);
    const grown = [...score.keys()]
      .filter(p => !seeds.has(p))
      .sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
    const keep = new Set<string>([...seeds.keys(), ...grown.slice(0, room)]);
    this.trimmed = Math.max(0, grown.length - room);

    // ---- nodes: one per real file, plus the chronology's moments -------
    const nodes: GNode[] = [];
    const byPath = new Map<string, GNode>();
    const links: GLink[] = [];
    let seq = 0;
    for (const path of keep) {
      const hex = this.tintFor(path);
      const rgb = toRGB(hex, 0x9aa7c7);
      const y = this.yearOfFile(path);
      const n: GNode = {
        id: `f:${path}`, type: "file", path, label: baseName(path),
        rgb, tint: rgb, size: 8, deg: 0, accent: false,
        year: y, known: y !== null,
        ax: WORLD_W / 2, ay: this.worldH / 2, axK: false,
        a: 0, hop: -1, drop: 0, born: seq++ * 2,
        x: WORLD_W / 2 + (Math.random() - 0.5) * 400,
        y: this.worldH / 2 + (Math.random() - 0.5) * 400,
      };
      const kept = remembered.get(n.id);
      if (kept) { n.x = kept.x; n.y = kept.y; }
      byPath.set(path, n);
      nodes.push(n);
    }
    // the chronology's moments — the ONLY nodes that own their year
    for (const ev of events) {
      const laneX = (laneF[ev.lane] ?? 0.5) * WORLD_W;
      const py = this.yForYear((ev.y0 + ev.y1) / 2);
      const rgb = toRGB(this.scope.laneColor[ev.lane] ?? FALLBACK_TINT, 0x9aa7c7);
      const n: GNode = {
        id: `e:${ev.id}`, type: "event", ev, label: ev.t,
        rgb, tint: rgb, size: 10, deg: 0, accent: false,
        year: ev.y0, known: true,
        ax: laneX, ay: py, axK: true,
        a: 0, hop: -1, drop: 0, born: seq++ * 2,
        x: laneX + (Math.random() - 0.5) * 60, fy: py, y: py,
      };
      const kept = remembered.get(n.id);
      if (kept) n.x = kept.x;
      nodes.push(n);
      // a moment holds onto the pages it cites — that is how time enters
      // the web at all; from here the vault's own links carry it outward
      for (const title of ev.chapters ?? []) {
        const f = app.metadataCache.getFirstLinkpathDest(title, "");
        const t = f instanceof TFile ? byPath.get(f.path) : null;
        if (t) links.push({ source: n, target: t, a: 0, tint: this.col.line, hop: -1 });
      }
    }
    // ---- links: every real wikilink between two kept pages ------------
    for (const src of keep) {
      const s = byPath.get(src)!;
      for (const dst of Object.keys(resolved[src] ?? {})) {
        if (src === dst) continue;
        const t = byPath.get(dst);
        if (!t) continue;
        // one line per pair, the way Obsidian dedups mutual links: when
        // both directions exist, only the earlier id draws it
        if (resolved[dst]?.[src] && src.localeCompare(dst) > 0) continue;
        links.push({ source: s, target: t, a: 0, tint: this.col.line, hop: -1 });
      }
    }
    this.nodes = nodes;
    this.links = links;
    for (const n of nodes) this.adj.set(n, []);
    for (const l of links) {
      const s = l.source as GNode, t = l.target as GNode;
      s.deg++; t.deg++;
      this.adj.get(s)!.push(t);
      this.adj.get(t)!.push(s);
    }
    for (const n of nodes) {
      const boost = n.type === "event"
        ? (n.ev!.imp === 1 ? 1.45 : n.ev!.imp === 2 ? 1.15 : 0.95) : 1;
      n.size = this.sizeFor(n.deg, boost);
    }

    // ---- time SPREADS along the links -----------------------------------
    // only moments and chapters know their year; every other page takes the
    // average of whatever dated neighbours it can see, three hops out. So a
    // person's page settles where the chapters that mention them live —
    // inferred from the vault, never placed by hand.
    for (let pass = 0; pass < 3; pass++) {
      const learned: [GNode, number][] = [];
      for (const n of nodes) {
        if (n.year !== null) continue;
        let sum = 0, c = 0;
        for (const m of this.adj.get(n) ?? []) {
          if (m.year !== null) { sum += m.year; c++; }
        }
        if (c) learned.push([n, sum / c]);
      }
      for (const [n, y] of learned) n.year = y;
      if (!learned.length) break;
    }
    // ---- the LANE spreads along the links too ---------------------------
    // Only moments know which world they belong to. Everything else finds
    // its side of the sky the same way it found its year: by averaging the
    // neighbours that already know. A Genesis study guide drifts into the
    // Bible lane, Nephi's page into the Book of Mormon lane — inferred,
    // never assigned. Without this every page anchors dead-centre and the
    // whole constellation collapses into one vertical smear.
    for (let pass = 0; pass < 4; pass++) {
      const learned: [GNode, number][] = [];
      for (const n of nodes) {
        if (n.axK) continue;
        let sx = 0, c = 0;
        for (const m of this.adj.get(n) ?? []) {
          if (m.axK) { sx += m.ax; c++; }
        }
        if (c) learned.push([n, sx / c]);
      }
      for (const [n, x] of learned) { n.ax = x; n.axK = true; }
      if (!learned.length) break;
    }
    for (const n of nodes) {
      if (n.type === "event") continue;
      n.ay = n.year !== null ? this.yForYear(n.year) : this.worldH / 2;
      // pages that share a lane must not stack on one line — spread them
      // across their lane's width by a stable hash of their own id
      let h = 0;
      for (let i = 0; i < n.id.length; i++) h = (h * 31 + n.id.charCodeAt(i)) | 0;
      n.ax += ((h % 1000) / 1000 - 0.5) * 260;
      if (!remembered.has(n.id)) {
        n.x = n.ax;
        if (n.year !== null) n.y = n.ay;
      }
    }
  }

  private startSim(): void {
    this.sim = forceSimulation<GNode>(this.nodes)
      .force("link", forceLink<GNode, GLink>(this.links).distance(74).strength(0.42))
      .force("charge", forceManyBody<GNode>()
        .strength(-340).distanceMin(20).distanceMax(760))
      .force("collide", forceCollide<GNode>(n => n.size + 7).strength(0.6))
      .force("x", forceX<GNode>(n => n.ax)
        .strength(n => n.type === "event" ? 0.14 : 0.07))
      // moments never leave their year; a page whose year was INFERRED is
      // only nudged toward it — the links get the final say
      .force("y", forceY<GNode>(n => n.ay)
        .strength(n => n.type === "event" ? 0 : n.known ? 0.14 : 0.05))
      .velocityDecay(0.4)
      .alphaDecay(0.0228)
      .alphaMin(0.001);
    this.sim.stop();          // we own the clock; d3's timer would race ours
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
        // a link belongs to the ring of its FARTHER end, so light travels
        // ALONG the threads rather than ahead of them
        if (s.hop >= 0 && t.hop >= 0) l.hop = Math.max(s.hop, t.hop);
      }
    }
    this.rippleAt = performance.now();
    this.animating = true;
  }

  private lit(): GNode | null {
    return this.dragging ?? this.selected ?? this.hover;
  }

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
      n.a = step(n.a, target, lit && n.hop > 0 ? n.hop * HOP_MS : 0);
      const tgt = n === lit ? this.col.accent : n.rgb;
      if (n.tint !== tgt) { n.tint = easeRGB(n.tint, tgt, f); moving = true; }
      const drop = n === lit ? LABEL_DROP_PX : 0;
      if (Math.abs(n.drop - drop) > 0.2) { n.drop = ease(n.drop, drop, dt, TAU); moving = true; }
      else n.drop = drop;
    }
    for (const l of this.links) {
      const target = !lit ? 1
        : l.hop < 0 ? DIM
          : HOP_ALPHA[Math.min(l.hop, HOP_ALPHA.length - 1)] ?? 1;
      l.a = step(l.a, target, lit && l.hop > 0 ? Math.max(0, (l.hop - 0.4) * HOP_MS) : 0);
      const tgt = l.hop >= 0 && lit ? this.col.accent : this.col.line;
      if (l.tint !== tgt) { l.tint = easeRGB(l.tint, tgt, f); moving = true; }
    }
    if (!this.panning && (Math.abs(this.vel.x) > 0.04 || Math.abs(this.vel.y) > 0.04)) {
      this.camT.x += this.vel.x; this.camT.y += this.vel.y;
      this.vel.x *= 0.92; this.vel.y *= 0.92;
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

  /** their nodeScale: on SCREEN a star grows as √zoom, never linearly */
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

    ctx.save();
    ctx.translate(this.cam.x, this.cam.y);
    ctx.scale(k, k);

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
      ctx.moveTo(-400, py); ctx.lineTo(WORLD_W + 400, py);
      ctx.stroke();
      ctx.fillStyle = rgbaStr(this.col.text, 0.3);
      ctx.fillText(yearStr(year), 14, py - 4);
    }

    ctx.lineWidth = LINK_WIDTH / k;
    ctx.setLineDash([]);
    for (const l of this.links) {
      if (l.a < 0.012) continue;
      const s = l.source as GNode, t = l.target as GNode;
      const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
      const dx = tx - sx, dy = ty - sy;
      const m = Math.hypot(dx, dy) || 1;
      const r0 = s.size * ns, r1 = t.size * ns;
      if (m <= r0 + r1) continue;
      ctx.strokeStyle = rgbaStr(l.tint, l.a * 0.85);
      ctx.beginPath();
      ctx.moveTo(sx + (dx / m) * r0, sy + (dy / m) * r0);
      ctx.lineTo(tx - (dx / m) * r1, ty - (dy / m) * r1);
      ctx.stroke();
    }

    const lit = this.lit();
    for (const n of this.nodes) {
      if (n.a < 0.012) continue;
      const r = n.size * ns;
      ctx.fillStyle = rgbaStr(n.tint, n.a);
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (n === lit) {
        const lw = Math.max(RING_MIN_PX / k, 1 / (k * ns));
        ctx.strokeStyle = rgbaStr(this.col.ring, n.a);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r + lw / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const textAlpha = Math.max(0, Math.min(1,
      Math.log(k) / Math.LN2 + 1 - TEXT_FADE_MULT));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const n of this.nodes) {
      const la = n === lit ? 1 : textAlpha * n.a;
      if (la < 0.02) continue;
      const x = n.x ?? 0, y = n.y ?? 0;
      const sx = x * k + this.cam.x, sy = y * k + this.cam.y;
      if (sx < -180 || sx > w + 180 || sy < -40 || sy > h + 60) continue;
      ctx.font = `${(14 + n.size / 4) * ns}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillStyle = rgbaStr(n === lit ? this.col.text : n.rgb, la);
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
        this.dragging = null; this.panning = false;
        return;
      }
      this.last = { x: ev.offsetX, y: ev.offsetY };
      const hit = this.nodeAt(ev.offsetX, ev.offsetY);
      if (hit) { this.dragging = hit; this.setRipple(hit); this.reheat(0.3); }
      else this.panning = true;
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
        // moments stay pinned to their year — the one law of this sky
        if (this.dragging.type !== "event") this.dragging.fy = wpt.y;
        this.moved = true; this.animating = true;
        return;
      }
      if (this.panning) {
        const dx = ev.offsetX - this.last.x, dy = ev.offsetY - this.last.y;
        this.camT.x += dx; this.camT.y += dy;
        this.cam.x += dx; this.cam.y += dy;
        this.vel = { x: dx * 0.6 + this.vel.x * 0.4, y: dy * 0.6 + this.vel.y * 0.4 };
        this.last = { x: ev.offsetX, y: ev.offsetY };
        this.moved = true; this.animating = true;
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
        if (n.type !== "event") n.fy = undefined;
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

  /** tap a star and it introduces itself — with the door to its page */
  private select(n: GNode | null): void {
    this.selected = n;
    this.setRipple(n ?? this.hover);
    this.chipEl?.remove();
    this.chipEl = null;
    if (!n) return;
    const chip = this.host.createDiv({ cls: "sg-tg-chip" });
    this.chipEl = chip;
    chip.createDiv({ cls: "sg-tg-chip-head" })
      .createSpan({ cls: "sg-tg-chip-name", text: n.label });
    if (n.type === "event") {
      const ev = n.ev!;
      const span = ev.y0 === ev.y1 ? yearStr(ev.y0) : `${yearStr(ev.y0)} – ${yearStr(ev.y1)}`;
      chip.createDiv({ cls: "sg-tg-chip-sub", text: `${span} · ${ev.note}` });
      const row = chip.createDiv({ cls: "sg-tg-chip-row" });
      for (const t of (ev.chapters ?? []).slice(0, 3)) {
        const b = row.createEl("button", { cls: "sg-tg-chip-btn", text: `📖 ${t}` });
        b.onclick = () => this.cbs.onOpenLink(t);
      }
    } else {
      const when = n.year === null ? "no date yet"
        : n.known ? yearStr(Math.round(n.year))
          : `around ${yearStr(Math.round(n.year))} — from its links`;
      chip.createDiv({
        cls: "sg-tg-chip-sub",
        text: `${when} · ${n.deg} connection${n.deg === 1 ? "" : "s"}`,
      });
      const row = chip.createDiv({ cls: "sg-tg-chip-row" });
      const open = row.createEl("button", { cls: "sg-tg-chip-btn", text: "↗ Open page" });
      open.onclick = () => this.cbs.onOpenPath(n.path!);
    }
    const x = chip.createEl("button", { cls: "sg-tg-chip-x", text: "✕" });
    x.onclick = () => this.select(null);
  }

  /** the legend names the shelves actually on screen — it grows with the
   * vault instead of listing categories that may not be here */
  private buildLegend(): void {
    const present = new Map<string, string>();
    for (const n of this.nodes) {
      if (n.type !== "file" || !n.path) continue;
      for (const [prefix, hex] of FOLDER_TINT) {
        if (n.path.startsWith(prefix)) {
          present.set(prefix.replace(/^AI Library\/\d+ /, "").replace(/\/$/, ""), hex);
          break;
        }
      }
    }
    const leg = this.host.createDiv({ cls: "sg-tg-legend" });
    for (const [label, hex] of [...present].slice(0, 5)) {
      const d = leg.createSpan({ cls: "sg-tg-leg" });
      d.createSpan({ cls: "sg-tg-leg-dot" }).style.background = hex;
      d.createSpan({ text: label });
    }
  }

  private buildHint(): void {
    const n = this.nodes.length;
    this.host.createDiv({
      cls: "sg-tg-hint",
      text: this.trimmed
        ? `${n} pages · ${this.trimmed} more trimmed to keep it smooth · tap a star`
        : `${n} pages, linked as the vault links them · tap a star`,
    });
  }
}
