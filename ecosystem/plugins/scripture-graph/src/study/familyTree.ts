/** The family tree — a tree. You at the root, at the bottom; your parents
 * above you, theirs above them, the branches spreading as they climb, each
 * person a round portrait on a limb.
 *
 * One canvas: drag to move, pinch or scroll to zoom, double-tap to zoom in
 * on a spot. A person with more behind them wears a small + above their
 * portrait: tap it and the next generations grow out of that branch, in
 * place, with everything else easing aside. A − on an opened branch folds
 * it back. Tap a portrait or a name to open the page.
 *
 * Drawn from the engine's "Family Tree" note: every person as a node (the
 * living by name only), parents by id, years, page title, thumbnail name.
 * Thumbnails are ~10 KB and fetched one at a time for the portraits on the
 * canvas; the photographs themselves come only when a page is opened. */
import { App, TFile } from "obsidian";
import { lazyFetch } from "../sync/vaultSync";

export interface TreeNode { n: string; b?: string; d?: string; f?: string; m?: string; page?: string; t?: string; living?: boolean }
export interface TreeData { roots: { pid: string; name: string }[]; people: Record<string, TreeNode> }

const FOLDER = "AI Library/12 Family";
const MEDIA = `${FOLDER}/_media`;
const OPEN_AT_START = 3;         // generations grown when the tree opens (you + 3)
const OPEN_PER_TAP = 2;          // generations a + grows
const NODE = 72;                 // portrait diameter
const SLOT_W = 150;              // horizontal room per leaf
const ROW_H = 176;               // vertical distance between generations
const LABEL_H = 44;
const TRUNK_H = 150;             // from the ground up to the root's portrait
const NS = "http://www.w3.org/2000/svg";

/** a limb's thickness at a generation: stout near the trunk, fine at the tips */
function limbWidth(depth: number): number { return Math.max(3.5, 18 * Math.pow(0.7, depth)); }

/** a deterministic scatter for foliage, from a person's id */
function seeded(pid: string): () => number {
  let h = 2166136261;
  for (const ch of pid) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

export async function loadTree(app: App): Promise<TreeData | null> {
  let f = app.metadataCache.getFirstLinkpathDest("Family Tree", "");
  if (!(f instanceof TFile) && lazyFetch) {
    if (await lazyFetch("Family Tree")) f = app.metadataCache.getFirstLinkpathDest("Family Tree", "");
  }
  if (!(f instanceof TFile)) return null;
  try {
    const raw = await app.vault.cachedRead(f);
    const m = /```json\s*([\s\S]*?)```/.exec(raw);
    return m ? (JSON.parse(m[1]!) as TreeData) : null;
  } catch { return null; }
}

export interface TreeHost {
  app: App;
  openNote: (link: string) => void;
  /** the Family shelf as a list */
  openList: () => void;
  /** a line of facts for the hint: build, scene */
  status?: () => string;
}

interface Placed { pid: string; depth: number; x: number; y: number; open: boolean; hasMore: boolean; side: "f" | "m" | "root" }

export class FamilyTree {
  private open = new Set<string>();          // people whose parents are grown
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private root: string;
  private canvas: HTMLElement | null = null;
  private layer: HTMLElement | null = null;
  private lines: SVGSVGElement | null = null;
  private nodes = new Map<string, HTMLElement>();
  private bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  constructor(private host: TreeHost, private data: TreeData, root: string) {
    this.root = root;
    this.grow(root, OPEN_AT_START);
  }

  // ------------------------------------------------------------- state

  private parents(pid: string): { pid: string; side: "f" | "m" }[] {
    const n = this.data.people[pid];
    if (!n) return [];
    const out: { pid: string; side: "f" | "m" }[] = [];
    if (n.f && this.data.people[n.f]) out.push({ pid: n.f, side: "f" });
    if (n.m && this.data.people[n.m]) out.push({ pid: n.m, side: "m" });
    return out;
  }

  private grow(pid: string, gens: number): void {
    if (gens <= 0 || !this.parents(pid).length) return;
    this.open.add(pid);
    for (const p of this.parents(pid)) this.grow(p.pid, gens - 1);
  }

  private fold(pid: string): void {
    this.open.delete(pid);
    for (const p of this.parents(pid)) this.fold(p.pid);
  }

  // ------------------------------------------------------------ layout

  /** a tidy tree: each leaf owns a slot; a person stands centred over the
   * parents grown above them. y climbs with the generation (negative = up). */
  private layout(): Placed[] {
    const placed: Placed[] = [];
    const place = (pid: string, depth: number, left: number, side: Placed["side"]): { width: number; x: number } => {
      const ps = this.open.has(pid) ? this.parents(pid) : [];
      if (!ps.length) {
        const x = left + SLOT_W / 2;
        placed.push({ pid, depth, x, y: -depth * ROW_H, open: false, hasMore: this.parents(pid).length > 0, side });
        return { width: SLOT_W, x };
      }
      let cursor = left;
      const xs: number[] = [];
      for (const p of ps) {
        const r = place(p.pid, depth + 1, cursor, p.side);
        xs.push(r.x);
        cursor += r.width;
      }
      const x = xs.length === 1 ? xs[0]! : (xs[0]! + xs[xs.length - 1]!) / 2;
      placed.push({ pid, depth, x, y: -depth * ROW_H, open: true, hasMore: true, side });
      return { width: cursor - left, x };
    };
    place(this.root, 0, 0, "root");
    // centre the root at x = 0
    const rootX = placed.find(p => p.pid === this.root)?.x ?? 0;
    for (const p of placed) p.x -= rootX;
    return placed;
  }

  // ------------------------------------------------------------ render

  render(c: HTMLElement): void {
    c.empty();
    c.addClass("sg-ft");
    const head = c.createDiv({ cls: "sg-ft-head" });
    if (this.data.roots.length > 1) {
      const chips = head.createDiv({ cls: "sg-ft-roots" });
      for (const r of this.data.roots) {
        const b = chips.createEl("button", { cls: `sg-ft-rootchip${r.pid === this.root ? " sg-ft-rootchip-on" : ""}`, text: `${r.name.split(" ")[0]}'s line` });
        b.onclick = () => { this.root = r.pid; this.open.clear(); this.grow(r.pid, OPEN_AT_START); this.nodes.clear(); this.render(c); };
      }
    }
    const zoom = head.createDiv({ cls: "sg-ft-zoom" });
    const zb = (label: string, title: string, fn: () => void) => { const b = zoom.createEl("button", { text: label, attr: { "aria-label": title } }); b.onclick = fn; };
    zb("−", "Zoom out", () => this.zoomBy(0.8));
    zb("+", "Zoom in", () => this.zoomBy(1.25));
    zb("⤢", "Fit the whole tree", () => this.fit(true));
    const list = head.createEl("button", { cls: "sg-ft-list", text: "All ancestors ›" });
    list.onclick = () => this.host.openList();

    const canvas = c.createDiv({ cls: "sg-ft-canvas" });
    this.canvas = canvas;
    canvas.createDiv({ cls: "sg-ft-sky" });
    canvas.createDiv({ cls: "sg-ft-ground" });
    const layer = canvas.createDiv({ cls: "sg-ft-layer" });
    this.layer = layer;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "sg-ft-lines");
    layer.appendChild(svg);
    this.lines = svg;
    this.nodes.clear();
    this.draw();
    this.wireGestures(canvas);
    // first sight: the root at the bottom middle, its branches in view
    window.requestAnimationFrame(() => this.fit(false));
    canvas.createDiv({ cls: "sg-ft-hint", text: `drag · pinch · double-tap  —  + grows a branch${this.host.status ? "  ·  " + this.host.status() : ""}` });
  }

  /** (re)draw from the open set; portraits keep their elements so a branch
   * grows and the others glide aside instead of flashing */
  private draw(anchor?: string): void {
    const layer = this.layer, svg = this.lines;
    if (!layer || !svg) return;
    const before = anchor ? this.nodes.get(anchor)?.getBoundingClientRect() : null;
    const placed = this.layout();
    const xs = placed.map(p => p.x), ys = placed.map(p => p.y);
    this.bounds = { minX: Math.min(...xs) - SLOT_W, maxX: Math.max(...xs) + SLOT_W, minY: Math.min(...ys) - NODE * 1.5, maxY: NODE / 2 + TRUNK_H + 40 };
    const b = this.bounds;
    svg.setAttribute("viewBox", `${b.minX} ${b.minY} ${b.maxX - b.minX} ${b.maxY - b.minY}`);
    svg.style.left = `${b.minX}px`; svg.style.top = `${b.minY}px`;
    svg.setAttribute("width", String(b.maxX - b.minX)); svg.setAttribute("height", String(b.maxY - b.minY));
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const keep = new Set(placed.map(p => p.pid));
    for (const [pid, el] of this.nodes) if (!keep.has(pid)) { el.addClass("sg-ft-gone"); window.setTimeout(() => el.remove(), 260); this.nodes.delete(pid); }
    const at = new Map(placed.map(p => [p.pid, p] as const));
    const el = (tag: string, attrs: Record<string, string | number>, parent: Element = svg): Element => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      parent.appendChild(e);
      return e;
    };
    // the ground, and the trunk rising out of it to the one at the root
    const rootY = 0;
    const groundY = rootY + NODE / 2 + TRUNK_H;
    const ground = el("g", { class: "sg-ft-earth" });
    el("ellipse", { cx: 0, cy: groundY + 6, rx: 260, ry: 26, class: "sg-ft-ground" }, ground);
    const gr = seeded("grass");
    for (let i = 0; i < 26; i++) {
      const gx = -230 + i * 18 + gr() * 10, gh = 10 + gr() * 16, lean = (gr() - 0.5) * 10;
      el("path", { d: `M ${gx} ${groundY + 2} q ${lean} ${-gh / 2} ${lean * 1.6} ${-gh}`, class: "sg-ft-grass" }, ground);
    }
    const tw = limbWidth(0) * 1.35;
    el("path", { d: `M ${-tw} ${groundY} C ${-tw * 0.9} ${groundY - TRUNK_H * 0.5}, ${-tw * 0.55} ${rootY + NODE * 0.7}, ${-tw * 0.5} ${rootY}`
      + ` L ${tw * 0.5} ${rootY} C ${tw * 0.55} ${rootY + NODE * 0.7}, ${tw * 0.9} ${groundY - TRUNK_H * 0.5}, ${tw} ${groundY}`
      + ` Q ${tw * 1.6} ${groundY + 6} ${tw * 2.2} ${groundY + 8} L ${-tw * 2.2} ${groundY + 8} Q ${-tw * 1.6} ${groundY + 6} ${-tw} ${groundY} Z`,
      class: "sg-ft-trunk" });
    el("path", { d: `M ${-tw * 0.2} ${groundY - 6} C ${-tw * 0.15} ${groundY - TRUNK_H * 0.5}, ${-tw * 0.1} ${rootY + NODE * 0.8}, ${-tw * 0.05} ${rootY + NODE / 2}`, class: "sg-ft-trunk-light" });
    // the limbs: wood, stout near the trunk and fine at the tips, each one
    // curving from a person up into the parent above; foliage where it lands
    const limbs = el("g", { class: "sg-ft-limbs" });
    const leaves = el("g", { class: "sg-ft-foliage" });
    for (const p of placed) {
      if (!p.open) continue;
      for (const parent of this.parents(p.pid)) {
        const q = at.get(parent.pid);
        if (!q) continue;
        const x1 = p.x, y1 = p.y, x2 = q.x, y2 = q.y + NODE * 0.35;
        const my = y1 - ROW_H * 0.55;
        const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${y2 + ROW_H * 0.35}, ${x2} ${y2}`;
        const w = limbWidth(q.depth);
        el("path", { d, class: `sg-ft-bark sg-ft-bark-${parent.side}`, "stroke-width": w.toFixed(1) }, limbs);
        el("path", { d, class: "sg-ft-bark-light", "stroke-width": (w * 0.35).toFixed(1) }, limbs);
        // foliage: a cluster of leaves behind the parent's portrait
        const r = seeded(parent.pid);
        for (let i = 0; i < 7; i++) {
          const a = r() * Math.PI * 2, dist = NODE * (0.35 + r() * 0.45);
          el("ellipse", { cx: (q.x + Math.cos(a) * dist).toFixed(1), cy: (q.y + Math.sin(a) * dist * 0.8).toFixed(1),
            rx: (14 + r() * 16).toFixed(1), ry: (10 + r() * 12).toFixed(1),
            transform: `rotate(${(r() * 90 - 45).toFixed(0)} ${q.x.toFixed(1)} ${q.y.toFixed(1)})`,
            class: `sg-ft-leaf sg-ft-leaf-${i % 3}` }, leaves);
        }
      }
    }
    // a crown for the root, too
    const r0 = seeded(this.root);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + r0() * Math.PI, dist = NODE * (0.4 + r0() * 0.4);
      el("ellipse", { cx: (Math.cos(a) * dist).toFixed(1), cy: (Math.sin(a) * dist * 0.8).toFixed(1), rx: (14 + r0() * 14).toFixed(1), ry: (10 + r0() * 10).toFixed(1),
        class: `sg-ft-leaf sg-ft-leaf-${i % 3}` }, leaves);
    }
    for (const p of placed) {
      let node = this.nodes.get(p.pid);
      const fresh = !node;
      if (!node) { node = this.node(p.pid, p.side); layer.appendChild(node); this.nodes.set(p.pid, node); }
      if (fresh) {
        // grow out of the person below, then ease into place
        const from = anchor ? at.get(anchor) : null;
        if (from) { node.style.transition = "none"; node.style.transform = `translate(${from.x - NODE / 2}px, ${from.y - NODE / 2}px) scale(0.4)`; node.style.opacity = "0"; void node.offsetWidth; node.style.transition = ""; }
      }
      node.style.transform = `translate(${p.x - NODE / 2}px, ${p.y - NODE / 2}px) scale(1)`;
      node.style.opacity = "1";
      this.paintPlus(node, p);
    }
    this.apply();
    if (before && anchor) {
      const after = this.nodes.get(anchor)?.getBoundingClientRect();
      if (after) { this.tx += before.left - after.left; this.ty += before.top - after.top; this.apply(); }
    }
  }

  private node(pid: string, side: Placed["side"]): HTMLElement {
    const n = this.data.people[pid];
    const el = createDiv({ cls: `sg-ft-node sg-ft-side-${side}${n?.living ? " sg-ft-living" : ""}${pid === this.root ? " sg-ft-root" : ""}` });
    const ring = el.createDiv({ cls: "sg-ft-ring" });
    const pic = ring.createDiv({ cls: "sg-ft-pic" });
    const name = n?.n ?? pid;
    pic.setText(name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(""));
    if (n?.t) void this.thumb(pic, pid, n.t);
    const label = el.createDiv({ cls: "sg-ft-label" });
    label.createDiv({ cls: "sg-ft-name", text: pid === this.root ? "You" : name });
    const years = n?.b || n?.d ? `${n.b ?? "?"} – ${n.d ?? ""}` : n?.living ? "living" : "";
    if (years) label.createDiv({ cls: "sg-ft-years", text: years });
    if (n?.page) {
      el.addClass("sg-ft-has-page");
      const openPage = (e: Event) => { if (this.moved) return; e.stopPropagation(); this.host.openNote(n.page!); };
      ring.onclick = openPage; label.onclick = openPage;
    }
    el.createEl("button", { cls: "sg-ft-plus", attr: { "aria-label": "More generations" } });
    return el;
  }

  private paintPlus(el: HTMLElement, p: Placed): void {
    const btn = el.querySelector<HTMLButtonElement>(".sg-ft-plus");
    if (!btn) return;
    if (!p.hasMore) { btn.hide(); return; }
    btn.show();
    btn.setText(p.open ? "−" : "+");
    btn.toggleClass("sg-ft-plus-open", p.open);
    btn.onclick = (e) => {
      e.stopPropagation();
      if (p.open) this.fold(p.pid); else this.grow(p.pid, OPEN_PER_TAP);
      this.draw(p.pid);
    };
  }

  /** the portrait: from the vault when it is here, fetched quietly when not */
  private async thumb(pic: HTMLElement, pid: string, file: string): Promise<void> {
    const path = `${MEDIA}/${pid}/${file}`;
    let f = this.host.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile) && lazyFetch) {
      if (!(await lazyFetch(path))) return;
      f = this.host.app.vault.getAbstractFileByPath(path);
    }
    if (!(f instanceof TFile) || !pic.isConnected) return;
    const img = pic.createEl("img", { attr: { loading: "lazy", alt: "", draggable: "false" } });
    img.src = this.host.app.vault.getResourcePath(f);
    img.onload = () => pic.addClass("sg-ft-haspic");
  }

  // ------------------------------------------------------- pan & zoom

  private moved = false;

  private apply(): void {
    if (this.layer) this.layer.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  private zoomBy(k: number, cx?: number, cy?: number): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const px = (cx ?? r.left + r.width / 2) - r.left, py = (cy ?? r.top + r.height / 2) - r.top;
    const next = Math.min(3, Math.max(0.2, this.scale * k));
    const f = next / this.scale;
    this.tx = px - (px - this.tx) * f;
    this.ty = py - (py - this.ty) * f;
    this.scale = next;
    this.apply();
  }

  /** whole: every grown branch in view; else: the root at the bottom
   * middle at a comfortable size, the first generations above it */
  private fit(whole: boolean): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const b = this.bounds;
    const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
    if (whole) {
      this.scale = Math.min(2, Math.max(0.2, Math.min((r.width - 40) / w, (r.height - 60) / h)));
    } else {
      this.scale = Math.min(1, Math.max(0.45, (r.width - 40) / Math.min(w, SLOT_W * 5)));
    }
    // x: centre the tree; y: the ground sits at the bottom of the screen
    this.tx = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale;
    this.ty = (r.height - 16) - b.maxY * this.scale;
    this.apply();
  }

  private wireGestures(canvas: HTMLElement): void {
    const pts = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number } | null = null;
    let pinch: number | null = null;
    let lastTap = 0;
    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.moved = false;
      if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a!.x - b!.x, a!.y - b!.y); }
    };
    canvas.onpointermove = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (d > 0) { this.zoomBy(d / pinch, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2); pinch = d; this.moved = true; }
        return;
      }
      if (pts.size === 1 && last) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        this.tx += dx; this.ty += dy; last = { x: e.clientX, y: e.clientY };
        this.apply();
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const p = [...pts.values()][0]!; last = { x: p.x, y: p.y }; } else last = null;
      if (!this.moved && pts.size === 0) {
        const now = Date.now();
        if (now - lastTap < 320 && !(e.target instanceof HTMLElement && e.target.closest(".sg-ft-node"))) this.zoomBy(1.6, e.clientX, e.clientY);
        lastTap = now;
      }
      window.setTimeout(() => { this.moved = false; }, 0);
    };
    canvas.onpointerup = up; canvas.onpointercancel = up;
    canvas.onwheel = (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); };
  }
}
