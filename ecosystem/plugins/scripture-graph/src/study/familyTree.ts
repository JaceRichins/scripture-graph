/** The family tree — a pedigree drawn from the engine's "Family Tree" note.
 *
 * The note is one small JSON block: every person as a node (the living by
 * name only), parents by id, years, the page title, a thumbnail file name.
 * The tree shows a focus person at the left and their ancestors fanning
 * right, four generations at a time; the last column offers "more" to walk
 * further up, and a way back down. Tapping a name opens the person's page
 * (fetched on demand on a phone, photos and all). Thumbnails are ~10 KB
 * each and fetched one at a time only for the cards on screen — the
 * heavy photos never travel until a page is opened. */
import { App, TFile } from "obsidian";
import { lazyFetch } from "../sync/vaultSync";

export interface TreeNode { n: string; b?: string; d?: string; f?: string; m?: string; page?: string; t?: string; living?: boolean }
export interface TreeData { roots: { pid: string; name: string }[]; people: Record<string, TreeNode> }

const FOLDER = "AI Library/12 Family";
const MEDIA = `${FOLDER}/_media`;
const GENERATIONS = 4;

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

export class FamilyTree {
  private focus: string;
  private trail: string[] = [];

  constructor(private host: TreeHost, private data: TreeData, private root: string) {
    this.focus = root;
  }

  render(c: HTMLElement): void {
    c.empty();
    c.addClass("sg-ft");
    // which line
    const head = c.createDiv({ cls: "sg-ft-head" });
    if (this.data.roots.length > 1) {
      const chips = head.createDiv({ cls: "sg-ft-roots" });
      for (const r of this.data.roots) {
        const b = chips.createEl("button", { cls: `sg-ft-rootchip${r.pid === this.root ? " sg-ft-rootchip-on" : ""}`, text: `${r.name.split(" ")[0]}'s line` });
        b.onclick = () => { this.root = r.pid; this.focus = r.pid; this.trail = []; this.render(c); };
      }
    }
    if (this.trail.length) {
      const back = head.createEl("button", { cls: "sg-ft-back", text: `‹ Back to ${this.name(this.trail[this.trail.length - 1]!)}` });
      back.onclick = () => { this.focus = this.trail.pop()!; this.render(c); };
    }
    const list = head.createEl("button", { cls: "sg-ft-list", text: "All ancestors ›" });
    list.onclick = () => this.host.openList();
    // the pedigree: focus at the left, ancestors fanning right
    const scroller = c.createDiv({ cls: "sg-ft-scroll" });
    scroller.appendChild(this.subtree(this.focus, 0));
  }

  private name(pid: string): string { return this.data.people[pid]?.n?.split(" ")[0] ?? "…"; }

  private subtree(pid: string, depth: number): HTMLElement {
    const node = this.data.people[pid];
    const wrap = createDiv({ cls: "sg-ft-node" });
    wrap.appendChild(this.card(pid, node, depth));
    if (!node) return wrap;
    const parents = [node.f, node.m].filter((p): p is string => !!p && !!this.data.people[p]);
    if (!parents.length) return wrap;
    if (depth >= GENERATIONS - 1) {
      const more = wrap.createEl("button", { cls: "sg-ft-more", text: "›", attr: { "aria-label": "Further back" } });
      more.onclick = () => { this.trail.push(this.focus); this.focus = pid; this.render(wrap.closest(".sg-ft") as HTMLElement); };
      return wrap;
    }
    const col = wrap.createDiv({ cls: "sg-ft-parents" });
    for (const p of parents) col.appendChild(this.subtree(p, depth + 1));
    return wrap;
  }

  private card(pid: string, node: TreeNode | undefined, depth: number): HTMLElement {
    const card = createDiv({ cls: `sg-ft-card${node?.living ? " sg-ft-living" : ""}${depth === 0 ? " sg-ft-focus" : ""}` });
    const pic = card.createDiv({ cls: "sg-ft-pic" });
    const name = node?.n ?? pid;
    pic.setText(name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join(""));
    if (node?.t) void this.thumb(pic, pid, node.t);
    const txt = card.createDiv({ cls: "sg-ft-txt" });
    txt.createDiv({ cls: "sg-ft-name", text: name });
    const years = node?.b || node?.d ? `${node.b ?? "?"}–${node.d ?? ""}` : node?.living ? "living" : "";
    if (years) txt.createDiv({ cls: "sg-ft-years", text: years });
    if (node?.page) {
      card.addClass("sg-ft-open");
      card.onclick = () => this.host.openNote(node.page!);
    }
    return card;
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
    const img = pic.createEl("img", { attr: { loading: "lazy", alt: "" } });
    img.src = this.host.app.vault.getResourcePath(f);
    img.onload = () => pic.addClass("sg-ft-haspic");
  }
}
