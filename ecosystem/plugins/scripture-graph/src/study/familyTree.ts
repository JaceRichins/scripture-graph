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

export interface TreeNode {
  n: string; b?: string; d?: string; f?: string; m?: string; page?: string; t?: string; living?: boolean;
  /** full dates and short places, when known */
  bf?: string; df?: string; bp?: string; dp?: string;
  /** what the shelf holds: photos & documents, stories, mentions in the library */
  ph?: number; st?: number; lib?: number;
}

const ORD = ["", "", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

/** "your father's mother's father · your great-grandfather" */
export function relationLabel(data: TreeData, root: string, pid: string): { path: string; kin: string } {
  if (pid === root) return { path: "", kin: "you" };
  // the first path from the root up to this person (a DAG: the first found will do)
  const seen = new Set<string>();
  const walk = (cur: string, steps: ("f" | "m")[]): ("f" | "m")[] | null => {
    if (cur === pid) return steps;
    if (seen.has(cur)) return null;
    seen.add(cur);
    const n = data.people[cur];
    if (!n) return null;
    for (const side of ["f", "m"] as const) {
      const next = n[side];
      if (!next) continue;
      const r = walk(next, [...steps, side]);
      if (r) return r;
    }
    return null;
  };
  const steps = walk(root, []);
  if (!steps) return { path: "", kin: "an ancestor" };
  const g = steps.length;
  const male = steps[steps.length - 1] === "f";
  const kin = g === 1 ? (male ? "father" : "mother")
    : g === 2 ? (male ? "grandfather" : "grandmother")
      : g === 3 ? (male ? "great-grandfather" : "great-grandmother")
        : `${ORD[g - 2] ?? `${g - 2}th`} great-grand${male ? "father" : "mother"}`;
  const words = steps.map(s => s === "f" ? "father" : "mother");
  const path = words.length > 1 ? words.map((w, i) => i < words.length - 1 ? `${w}'s` : w).join(" ") : "";
  return { path: path ? `your ${path}` : "", kin: `your ${kin}` };
}

/** "3 Apr 1905" / "April 3, 1905" / "1905" → month-day, when the date has one */
export function monthDay(date: string | undefined): { m: number; d: number } | null {
  if (!date) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const t = date.toLowerCase();
  const mi = months.findIndex(mo => t.includes(mo));
  const dm = /(^|\D)(\d{1,2})(\D|$)/.exec(t.replace(/\d{4}/, ""));
  if (mi < 0 || !dm) return null;
  return { m: mi + 1, d: Number(dm[2]) };
}
export interface TreeData { roots: { pid: string; name: string }[]; people: Record<string, TreeNode> }

const FOLDER = "AI Library/12 Family";
const MEDIA = `${FOLDER}/_media`;
const OPEN_AT_START = 3;         // generations grown when the tree opens (you + 3)
const OPEN_PER_TAP = 2;          // generations a + grows
const NODE = 64;                 // portrait diameter
const SLOT_W = 156;              // horizontal room per leaf
const ROW_H = 186;               // vertical distance between generations
const LABEL_H = 44;
const TRUNK_H = 150;             // from the ground up to the root's portrait
const NS = "http://www.w3.org/2000/svg";

/** a limb's thickness at a generation: stout near the trunk, fine at the tips */
function limbWidth(depth: number): number { return Math.max(2.5, 13 * Math.pow(0.68, depth)); }

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
    if (this.data.roots.length <= 1) head.remove();

    const canvas = c.createDiv({ cls: "sg-ft-canvas" });
    // three quiet tools in the corner: fit, the years, the list
    const tools = canvas.createDiv({ cls: "sg-ft-tools" });
    tools.onpointerdown = (e) => e.stopPropagation();
    const tool = (label: string, title: string, fn: () => void) => { const b = tools.createEl("button", { text: label, attr: { "aria-label": title } }); b.onclick = fn; return b; };
    tool("⤢", "Fit the whole tree", () => this.fit(true));
    const clock = tool("⏳", "Who was alive in a given year", () => {
      const bar = canvas.querySelector<HTMLElement>(".sg-ft-time");
      if (!bar) return;
      bar.hidden = !bar.hidden;
      clock.toggleClass("sg-ft-tool-on", !bar.hidden);
      if (bar.hidden) this.setYear(null);
    });
    tool("☰", "All ancestors, as a list", () => this.host.openList());
    // Obsidian's edge swipe opens its drawers over a pan: the same opt-out
    // its own sliders and canvas use keeps the gesture ours here
    c.dataset["ignoreSwipe"] = "true";
    canvas.dataset["ignoreSwipe"] = "true";
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
    this.timeBar(canvas);
    const bar = canvas.querySelector<HTMLElement>(".sg-ft-time");
    if (bar) bar.hidden = true;
    // first sight: the root at the bottom middle, its branches in view
    window.requestAnimationFrame(() => this.fit(false));
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
    const tw = limbWidth(0) * 1.1;
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
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (1.05 + r() * 0.9), dist = NODE * (0.42 + r() * 0.3);   // the upper half, behind the portrait
          el("ellipse", { cx: (q.x + Math.cos(a) * dist).toFixed(1), cy: (q.y + Math.sin(a) * dist * 0.85).toFixed(1),
            rx: (9 + r() * 9).toFixed(1), ry: (6 + r() * 6).toFixed(1),
            transform: `rotate(${(r() * 120 - 60).toFixed(0)} ${q.x.toFixed(1)} ${q.y.toFixed(1)})`,
            class: `sg-ft-leaf sg-ft-leaf-${i % 3}` }, leaves);
        }
      }
    }
    // a crown for the root, too
    const r0 = seeded(this.root);
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.05 + r0() * 0.9), dist = NODE * (0.42 + r0() * 0.3);
      el("ellipse", { cx: (Math.cos(a) * dist).toFixed(1), cy: (Math.sin(a) * dist * 0.85).toFixed(1), rx: (9 + r0() * 9).toFixed(1), ry: (6 + r0() * 6).toFixed(1),
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
    if (this.year !== null) this.setYear(this.year);
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
    // what the shelf holds for them, at a glance
    const badges = ring.createDiv({ cls: "sg-ft-badges" });
    if (n?.st) badges.createSpan({ cls: "sg-ft-badge", text: "📖", attr: { "aria-label": `${n.st} stories` } });
    if (n?.ph) badges.createSpan({ cls: "sg-ft-badge", text: "📷", attr: { "aria-label": `${n.ph} photos` } });
    if (n?.lib) badges.createSpan({ cls: "sg-ft-badge", text: "⛪", attr: { "aria-label": `${n.lib} pages mention them` } });
    el.createDiv({ cls: "sg-ft-age" });
    const label = el.createDiv({ cls: "sg-ft-label" });
    label.createDiv({ cls: "sg-ft-name", text: pid === this.root ? "You" : name });
    const years = n?.b || n?.d ? `${n.b ?? "?"} – ${n.d ?? ""}` : n?.living ? "living" : "";
    if (years) label.createDiv({ cls: "sg-ft-years", text: years });
    ring.onclick = (e) => { if (this.moved) return; e.stopPropagation(); this.showCard(pid); };
    if (n?.page) {
      el.addClass("sg-ft-has-page");
      label.onclick = (e) => { if (this.moved) return; e.stopPropagation(); this.host.openNote(n.page!); };
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

  // ------------------------------------------------------------ the card

  private cardEl: HTMLElement | null = null;

  /** who this is to you, where they were born and died, what the shelf holds */
  private showCard(pid: string): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.cardEl?.remove();
    const n = this.data.people[pid];
    const card = canvas.createDiv({ cls: "sg-ft-sheet" });
    this.cardEl = card;
    card.onpointerdown = (e) => e.stopPropagation();
    const close = card.createEl("button", { cls: "sg-ft-sheet-x", text: "✕" });
    close.onclick = () => { card.remove(); this.cardEl = null; };
    const top = card.createDiv({ cls: "sg-ft-sheet-top" });
    const pic = top.createDiv({ cls: "sg-ft-pic sg-ft-sheet-pic" });
    const name = n?.n ?? pid;
    pic.setText(name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(""));
    if (n?.t) void this.thumb(pic, pid, n.t);
    const txt = top.createDiv({ cls: "sg-ft-sheet-txt" });
    txt.createDiv({ cls: "sg-ft-sheet-name", text: name });
    const rel = relationLabel(this.data, this.root, pid);
    txt.createDiv({ cls: "sg-ft-sheet-kin", text: rel.path && rel.path !== rel.kin ? `${rel.kin} — ${rel.path}` : rel.kin });
    const facts = card.createDiv({ cls: "sg-ft-sheet-facts" });
    const fact = (label: string, value: string) => { const r = facts.createDiv({ cls: "sg-ft-sheet-fact" }); r.createSpan({ cls: "sg-ft-sheet-k", text: label }); r.createSpan({ text: value }); };
    if (n?.bf || n?.bp) fact("Born", [n.bf, n.bp].filter(Boolean).join(" · "));
    if (n?.df || n?.dp) fact("Died", [n.df, n.dp].filter(Boolean).join(" · "));
    if (n?.b && n?.d) fact("Lived", `${Number(n.d) - Number(n.b)} years`);
    if (n?.living) fact("", "Living — kept private");
    const holds = [n?.ph ? `${n.ph} photo${n.ph === 1 ? "" : "s"} & documents` : "", n?.st ? `${n.st} stor${n.st === 1 ? "y" : "ies"}` : "",
      n?.lib ? `mentioned on ${n.lib} page${n.lib === 1 ? "" : "s"} in the library` : ""].filter(Boolean);
    if (holds.length) fact("On the shelf", holds.join(" · "));
    const acts = card.createDiv({ cls: "sg-ft-sheet-acts" });
    if (n?.page) { const b = acts.createEl("button", { cls: "mod-cta", text: "Open their page" }); b.onclick = () => this.host.openNote(n.page!); }
    if (this.parents(pid).length) {
      const open = this.open.has(pid);
      const b = acts.createEl("button", { text: open ? "Fold this branch" : "Grow this branch" });
      b.onclick = () => { if (open) this.fold(pid); else this.grow(pid, OPEN_PER_TAP); this.draw(pid); card.remove(); this.cardEl = null; };
    }
  }

  // ------------------------------------------------------------ the years

  private year: number | null = null;

  /** the tree in a given year: who was alive, and how old */
  private setYear(y: number | null): void {
    this.year = y;
    for (const [pid, el] of this.nodes) {
      const n = this.data.people[pid];
      const age = el.querySelector<HTMLElement>(".sg-ft-age");
      el.removeClass("sg-ft-alive", "sg-ft-unborn", "sg-ft-passed");
      if (y === null || !n) { age?.setText(""); continue; }
      const b = n.b ? Number(n.b) : null, d = n.d ? Number(n.d) : null;
      if (b === null) {
        // the living carry no dates: not yet born before living memory, alive after
        age?.setText("");
        if (n.living) el.addClass(y < 1920 ? "sg-ft-unborn" : "sg-ft-alive");
        continue;
      }
      const until = d ?? (n.living ? new Date().getFullYear() : b + 90);
      if (y < b) { el.addClass("sg-ft-unborn"); age?.setText(""); }
      else if (y > until) { el.addClass("sg-ft-passed"); age?.setText(""); }
      else { el.addClass("sg-ft-alive"); age?.setText(`${y - b}`); }
    }
  }

  private timeBar(c: HTMLElement): void {
    const years = Object.values(this.data.people).map(n => n.b ? Number(n.b) : NaN).filter(v => !Number.isNaN(v));
    if (!years.length) return;
    const min = Math.min(...years), max = new Date().getFullYear();
    const bar = c.createDiv({ cls: "sg-ft-time" });
    bar.onpointerdown = (e) => e.stopPropagation();
    const row = bar.createDiv({ cls: "sg-ft-time-row" });
    const label = row.createDiv({ cls: "sg-ft-time-label", text: "Alive in…" });
    const range = row.createEl("input", { cls: "sg-ft-time-range", attr: { type: "range", min: String(min), max: String(max), value: String(max), step: "1" } });
    const clear = row.createEl("button", { cls: "sg-ft-time-x", text: "✕", attr: { "aria-label": "Show everyone" } });
    const setLabel = () => label.setText(this.year === null ? "Alive in…" : `In ${this.year}`);
    range.oninput = () => { this.setYear(Number(range.value)); setLabel(); };
    clear.onclick = () => { this.setYear(null); range.value = String(max); setLabel(); };
    const chips = bar.createDiv({ cls: "sg-ft-time-chips" });
    const marks: [number, string][] = [[1830, "1830"], [1847, "1847"], [1856, "1856"], [1900, "1900"], [1950, "1950"], [max, "now"]];
    for (const [y, t] of marks) {
      if (y < min - 10) continue;
      const b = chips.createEl("button", { cls: "sg-ft-chip", text: t });
      b.onclick = () => { range.value = String(y); this.setYear(y); setLabel(); };
    }
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
      this.scale = Math.min(1, Math.max(0.5, (r.width - 24) / Math.min(w, SLOT_W * 4.2)));
    }
    // x: centre the tree; y: the ground sits at the bottom of the screen
    this.tx = r.width / 2 - ((b.minX + b.maxX) / 2) * this.scale;
    this.ty = (r.height - 12) - b.maxY * this.scale;
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
        if (Math.abs(dx) + Math.abs(dy) > 3) { this.moved = true; if (this.cardEl) { this.cardEl.remove(); this.cardEl = null; } }
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
