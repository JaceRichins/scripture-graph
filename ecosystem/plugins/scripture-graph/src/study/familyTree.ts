/** The family tree — a pedigree chart, the way FamilySearch draws one.
 *
 * One canvas: you at the left, parents to the right, their parents beyond,
 * joined by lines. Drag to pan, pinch or scroll to zoom, and every person
 * with more behind them carries an arrow that opens the next generations in
 * place — the chart grows, nothing re-centres or re-roots. A "−" folds a
 * branch back. Tap a name to open the page.
 *
 * Drawn from the engine's "Family Tree" note: one JSON block with every
 * person as a node (the living by name only), parents by id, years, page
 * title and a thumbnail name. Thumbnails are ~10 KB and fetched one at a
 * time for the cards that exist; the photos themselves come only when a
 * page is opened. */
import { App, TFile } from "obsidian";
import { lazyFetch } from "../sync/vaultSync";

export interface TreeNode { n: string; b?: string; d?: string; f?: string; m?: string; page?: string; t?: string; living?: boolean }
export interface TreeData { roots: { pid: string; name: string }[]; people: Record<string, TreeNode> }

const FOLDER = "AI Library/12 Family";
const MEDIA = `${FOLDER}/_media`;
const OPEN_AT_START = 4;        // generations shown when the chart opens
const OPEN_PER_TAP = 2;         // generations an arrow opens
const CARD_W = 172, CARD_H = 58, COL = 236, ROW = 70;

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
}

interface Placed { pid: string; depth: number; x: number; y: number; open: boolean; hasMore: boolean }

export class FamilyTree {
  private open = new Set<string>();          // people whose parents are shown
  private scale = 1;
  private tx = 24;
  private ty = 24;
  private root: string;
  private canvas: HTMLElement | null = null;
  private layer: HTMLElement | null = null;
  private lines: SVGSVGElement | null = null;
  private cards = new Map<string, HTMLElement>();

  constructor(private host: TreeHost, private data: TreeData, root: string) {
    this.root = root;
    this.openGenerations(root, OPEN_AT_START);
  }

  // ------------------------------------------------------------- state

  private parents(pid: string): string[] {
    const n = this.data.people[pid];
    return n ? [n.f, n.m].filter((p): p is string => !!p && !!this.data.people[p]) : [];
  }

  private openGenerations(pid: string, gens: number): void {
    if (gens <= 0 || !this.parents(pid).length) return;
    this.open.add(pid);
    for (const p of this.parents(pid)) this.openGenerations(p, gens - 1);
  }

  private closeBranch(pid: string): void {
    this.open.delete(pid);
    for (const p of this.parents(pid)) this.closeBranch(p);
  }

  // ------------------------------------------------------------ layout

  /** rows a subtree needs, and the y (in rows) of each node: a person sits
   * at the midpoint of the parents shown behind them */
  private layout(): { placed: Placed[]; rows: number; cols: number } {
    const placed: Placed[] = [];
    let cols = 0;
    const place = (pid: string, depth: number, top: number): { rows: number; y: number } => {
      cols = Math.max(cols, depth + 1);
      const ps = this.open.has(pid) ? this.parents(pid) : [];
      if (!ps.length) {
        placed.push({ pid, depth, x: depth * COL, y: top * ROW, open: false, hasMore: this.parents(pid).length > 0 });
        return { rows: 1, y: top };
      }
      let cursor = top;
      const ys: number[] = [];
      for (const p of ps) {
        const r = place(p, depth + 1, cursor);
        ys.push(r.y);
        cursor += r.rows;
      }
      const y = ys.length === 1 ? ys[0]! : (ys[0]! + ys[ys.length - 1]!) / 2;
      placed.push({ pid, depth, x: depth * COL, y: y * ROW, open: true, hasMore: true });
      return { rows: cursor - top, y };
    };
    const r = place(this.root, 0, 0);
    return { placed, rows: r.rows, cols };
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
        b.onclick = () => { this.root = r.pid; this.open.clear(); this.openGenerations(r.pid, OPEN_AT_START); this.tx = 24; this.ty = 24; this.scale = 1; this.render(c); };
      }
    }
    const zoom = head.createDiv({ cls: "sg-ft-zoom" });
    const zb = (label: string, title: string, fn: () => void) => { const b = zoom.createEl("button", { text: label, attr: { "aria-label": title } }); b.onclick = fn; };
    zb("−", "Zoom out", () => this.zoomBy(0.8));
    zb("+", "Zoom in", () => this.zoomBy(1.25));
    zb("⤢", "Fit", () => this.fit());
    const list = head.createEl("button", { cls: "sg-ft-list", text: "All ancestors ›" });
    list.onclick = () => this.host.openList();

    const canvas = c.createDiv({ cls: "sg-ft-canvas" });
    this.canvas = canvas;
    const layer = canvas.createDiv({ cls: "sg-ft-layer" });
    this.layer = layer;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "sg-ft-lines");
    layer.appendChild(svg);
    this.lines = svg;
    this.cards.clear();
    this.draw();
    this.wireGestures(canvas);
    canvas.createDiv({ cls: "sg-ft-hint", text: "Drag to move · pinch to zoom · › opens more" });
  }

  /** (re)draw the chart from the current open set; cards keep their
   * elements so a tap on an arrow grows the tree without a flash */
  private draw(anchor?: string): void {
    const layer = this.layer, svg = this.lines;
    if (!layer || !svg) return;
    const before = anchor ? this.cards.get(anchor)?.getBoundingClientRect() : null;
    const { placed, rows, cols } = this.layout();
    const width = cols * COL + CARD_W, height = Math.max(1, rows) * ROW + CARD_H;
    layer.style.width = `${width}px`; layer.style.height = `${height}px`;
    svg.setAttribute("width", String(width)); svg.setAttribute("height", String(height));
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const keep = new Set(placed.map(p => p.pid));
    for (const [pid, el] of this.cards) if (!keep.has(pid)) { el.remove(); this.cards.delete(pid); }
    const at = new Map(placed.map(p => [p.pid, p] as const));
    for (const p of placed) {
      let card = this.cards.get(p.pid);
      if (!card) { card = this.card(p.pid); layer.appendChild(card); this.cards.set(p.pid, card); }
      card.style.transform = `translate(${p.x}px, ${p.y}px)`;
      this.paintArrow(card, p);
      // lines to the parents shown behind this person
      if (p.open) {
        for (const parent of this.parents(p.pid)) {
          const q = at.get(parent);
          if (!q) continue;
          const x1 = p.x + CARD_W, y1 = p.y + CARD_H / 2, x2 = q.x, y2 = q.y + CARD_H / 2, mx = x1 + (x2 - x1) / 2;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`);
          svg.appendChild(path);
        }
      }
    }
    this.apply();
    // the tapped card stays where the finger was
    if (before && anchor) {
      const after = this.cards.get(anchor)?.getBoundingClientRect();
      if (after) { this.tx += before.left - after.left; this.ty += before.top - after.top; this.apply(); }
    }
  }

  private card(pid: string): HTMLElement {
    const node = this.data.people[pid];
    const card = createDiv({ cls: `sg-ft-card${node?.living ? " sg-ft-living" : ""}${pid === this.root ? " sg-ft-focus" : ""}` });
    card.style.width = `${CARD_W}px`; card.style.height = `${CARD_H}px`;
    const pic = card.createDiv({ cls: "sg-ft-pic" });
    const name = node?.n ?? pid;
    pic.setText(name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(""));
    if (node?.t) void this.thumb(pic, pid, node.t);
    const txt = card.createDiv({ cls: "sg-ft-txt" });
    txt.createDiv({ cls: "sg-ft-name", text: name });
    const years = node?.b || node?.d ? `${node.b ?? "?"}–${node.d ?? ""}` : node?.living ? "living" : "";
    if (years) txt.createDiv({ cls: "sg-ft-years", text: years });
    if (node?.page) {
      txt.addClass("sg-ft-open");
      txt.onclick = (e) => { if (this.moved) return; e.stopPropagation(); this.host.openNote(node.page!); };
    }
    card.createEl("button", { cls: "sg-ft-arrow", attr: { "aria-label": "More generations" } });
    return card;
  }

  private paintArrow(card: HTMLElement, p: Placed): void {
    const btn = card.querySelector<HTMLButtonElement>(".sg-ft-arrow");
    if (!btn) return;
    if (!p.hasMore) { btn.hide(); return; }
    btn.show();
    btn.setText(p.open ? "−" : "›");
    btn.toggleClass("sg-ft-arrow-open", p.open);
    btn.onclick = (e) => {
      e.stopPropagation();
      if (p.open) this.closeBranch(p.pid); else this.openGenerations(p.pid, OPEN_PER_TAP);
      this.draw(p.pid);
    };
  }

  /** the thumbnail: from the vault when it is here, fetched quietly when not */
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
    const next = Math.min(2.5, Math.max(0.25, this.scale * k));
    const f = next / this.scale;
    this.tx = px - (px - this.tx) * f;
    this.ty = py - (py - this.ty) * f;
    this.scale = next;
    this.apply();
  }

  private fit(): void {
    const canvas = this.canvas, layer = this.layer;
    if (!canvas || !layer) return;
    const w = parseFloat(layer.style.width) || 1, h = parseFloat(layer.style.height) || 1;
    const r = canvas.getBoundingClientRect();
    this.scale = Math.min(2, Math.max(0.25, Math.min((r.width - 24) / w, (r.height - 24) / h)));
    this.tx = (r.width - w * this.scale) / 2; this.ty = (r.height - h * this.scale) / 2;
    this.apply();
  }

  private wireGestures(canvas: HTMLElement): void {
    const pts = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number } | null = null;
    let pinch: number | null = null;
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
      window.setTimeout(() => { this.moved = false; }, 0);
    };
    canvas.onpointerup = up; canvas.onpointercancel = up;
    canvas.onwheel = (e) => { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); };
  }
}
