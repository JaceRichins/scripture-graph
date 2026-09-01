/** 🕸 Graph presets — the 75,000-connection graph, pre-filtered.
 *
 * The full vault graph is beautiful and unusable: 10k+ nodes flatten the
 * GPU. Each preset writes a curated graph.json (path-scoped search filter,
 * color groups, calm display and forces) and opens a FRESH graph view on
 * it — so the graph arrives already tamed: hundreds of nodes, not
 * thousands, tags and attachments off, orphans hidden, sane zoom. The
 * config you had is saved to graph.json.bak first, so a hand-tuned setup
 * is one file-rename from coming back.
 *
 * Phones get extra mercy: label fade pushed way down (label textures are
 * what actually kill mobile GPUs), thinner lines, and the widest presets
 * swap to a trimmed search — plus a loading veil that swallows touches
 * until the web has settled, because panning mid-settle is exactly when
 * phones crash. */
import { Notice, Platform, type App, type WorkspaceLeaf } from "obsidian";
import { type NavIconName } from "./navIcons";

export interface GraphPreset {
  id: string;
  icon: NavIconName;
  name: string;
  desc: string;
  weight: "light" | "medium" | "heavy";
  search: string;
  groups: { query: string; hex: string }[];
  extra?: Record<string, unknown>;
  /** phone-sized substitutes: a narrower search, harsher display floors,
   * and the honest one-liner the shelf shows instead of `desc` */
  mobile?: { search?: string; extra?: Record<string, unknown>; note?: string };
}

const CHRIST_NAMES =
  `Jesus OR Christ OR Messiah OR Jehovah OR Immanuel OR "Son of God" OR "Lamb of God" OR "Son of Man" OR Redeemer OR Savior`;

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "christ", icon: "graph", name: "Names of Christ",
    desc: "Every page that speaks His name — one color per title",
    weight: "medium",
    search: CHRIST_NAMES,
    groups: [
      { query: "Jesus", hex: "#e05252" },
      { query: "Christ", hex: "#e0b152" },
      { query: "Messiah", hex: "#b1e052" },
      { query: "Jehovah", hex: "#52e052" },
      { query: "Immanuel", hex: "#52e0b1" },
      { query: "Son of God", hex: "#52b1e0" },
      { query: "Son of Man", hex: "#5252e0" },
      { query: "Savior", hex: "#b152e0" },
    ],
    extra: { nodeSizeMultiplier: 0.8, scale: 0.14, repelStrength: 16,
      textFadeMultiplier: -1 },
    mobile: {
      // full-text over 10k files = thousands of nodes = a dead phone.
      // Scope the same names to the pages ABOUT people, topics & the
      // dictionary — the weave survives, the node count doesn't explode.
      search: `(${CHRIST_NAMES}) (path:"AI Library/03 People" OR path:"AI Library/02 Gospel Topics" OR path:"AI Library/80 Bible Dictionary")`,
      note: "His names across people, topics & dictionary — sized for a phone",
    },
  },
  {
    id: "people", icon: "person", name: "People",
    desc: "Every person page and how they link to one another",
    weight: "light",
    search: `path:"AI Library/03 People"`,
    groups: [{ query: `path:"AI Library/03 People"`, hex: "#f0b884" }],
  },
  {
    id: "places", icon: "place", name: "Places",
    desc: "The lands and cities, joined by their stories",
    weight: "light",
    search: `path:"AI Library/04 Places"`,
    groups: [{ query: `path:"AI Library/04 Places"`, hex: "#8fd0f4" }],
  },
  {
    id: "people-places", icon: "groups", name: "People & Places",
    desc: "Who walked where — two constellations, one sky",
    weight: "light",
    search: `path:"AI Library/03 People" OR path:"AI Library/04 Places"`,
    groups: [
      { query: `path:"AI Library/03 People"`, hex: "#f0b884" },
      { query: `path:"AI Library/04 Places"`, hex: "#8fd0f4" },
    ],
  },
  {
    id: "topics", icon: "topics", name: "Gospel Topics",
    desc: "Doctrines and themes, linked by shared scripture",
    weight: "light",
    search: `path:"AI Library/02 Gospel Topics"`,
    groups: [{ query: `path:"AI Library/02 Gospel Topics"`, hex: "#79d2c3" }],
  },
  {
    id: "chapters", icon: "chapter", name: "Chapters",
    desc: "All 1,584 chapters and their cross-links",
    weight: "medium",
    search: `path:"AI Library/01 Scriptures/Canonical"`,
    groups: [{ query: `path:"AI Library/01 Scriptures/Canonical"`, hex: "#8ec7f0" }],
    extra: { nodeSizeMultiplier: 0.9, scale: 0.22, repelStrength: 16 },
  },
  {
    id: "study", icon: "hub", name: "My Study",
    desc: "Your own pages and notes — the graph you are writing",
    weight: "medium",
    search: `path:"Library"`,
    groups: [{ query: `path:"Library"`, hex: "#c9b8ff" }],
    extra: { scale: 0.22 },
  },
  {
    id: "everything", icon: "library", name: "Everything",
    desc: "The whole vault, tuned as far down as it goes — still heavy",
    weight: "heavy",
    search: "",
    groups: [
      { query: `path:"AI Library/03 People"`, hex: "#f0b884" },
      { query: `path:"AI Library/04 Places"`, hex: "#8fd0f4" },
      { query: `path:"AI Library/02 Gospel Topics"`, hex: "#79d2c3" },
      { query: `path:"Library"`, hex: "#c9b8ff" },
    ],
    extra: { nodeSizeMultiplier: 0.8, lineSizeMultiplier: 0.5, scale: 0.12,
      textFadeMultiplier: -1.2, repelStrength: 18 },
    mobile: {
      search: `path:"AI Library/03 People" OR path:"AI Library/04 Places" OR path:"AI Library/02 Gospel Topics" OR path:"Library"`,
      note: "Trimmed for phones: people, places, topics & your study",
    },
  },
];

const hexToInt = (hex: string): number => parseInt(hex.replace("#", ""), 16);

/** label textures are the mobile-GPU killer — on phones they only appear
 * when zoomed way in, and lines slim down */
const MOBILE_FLOOR: Record<string, unknown> = {
  textFadeMultiplier: -1.6,
  lineSizeMultiplier: 0.45,
};

/** the perf floor every preset stands on */
function optionsFor(p: GraphPreset): Record<string, unknown> {
  const mobile = Platform.isMobile;
  return {
    "collapse-filter": true,
    search: (mobile && p.mobile?.search) || p.search,
    showTags: false,
    showAttachments: false,
    hideUnresolved: true,
    showOrphans: false,
    "collapse-color-groups": true,
    colorGroups: p.groups.map(g => ({ query: g.query, color: { a: 1, rgb: hexToInt(g.hex) } })),
    "collapse-display": true,
    showArrow: false,
    textFadeMultiplier: -0.4,
    nodeSizeMultiplier: 1.1,
    lineSizeMultiplier: 0.8,
    "collapse-forces": true,
    centerStrength: 0.45,
    repelStrength: 13,
    linkStrength: 0.9,
    linkDistance: 160,
    scale: 0.32,
    close: true,
    ...(p.extra ?? {}),
    ...(mobile ? MOBILE_FLOOR : {}),
    ...(mobile ? p.mobile?.extra ?? {} : {}),
  };
}

// ------------------------------------------------------------ loading veil

/** how long each weight is given to settle before the veil lets go */
const SETTLE_MS = { light: 1100, medium: 2200, heavy: 3600 } as const;
const VEIL_CAP_MS = 9000;

/** The Graphs-shelf icon come alive: the same four-dot constellation, dots
 * pulsing in the preset's own colors while the real graph gathers behind
 * it. The veil also EATS touches — panning mid-settle is what crashes
 * phones — and a tap lets the impatient through early. */
function raiseVeil(host: HTMLElement, p: GraphPreset): { sub: HTMLElement; lower: () => void } {
  const veil = host.createDiv({ cls: "sg-gveil" });
  const hexes = p.groups.length ? p.groups.map(g => g.hex) : ["#8fb8ff"];
  const dot = (cx: number, cy: number, r: number, i: number) =>
    `<circle class="sg-gveil-dot" cx="${cx}" cy="${cy}" r="${r}"`
    + ` fill="${hexes[i % hexes.length]}" style="animation-delay:${i * 0.22}s"/>`;
  // static, plugin-authored markup — no vault data anywhere near it
  veil.createDiv({ cls: "sg-gveil-art" }).innerHTML =
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path class="sg-gveil-lines" d="M8.2 7.4 16 8.2M7 8.7l1.2 7.2M10.5 17.4l4.9-.3M15.9 9.9l.7 5.4"/>
      ${dot(6, 6.5, 2.4, 0)}${dot(18, 8.5, 2, 1)}${dot(8.5, 18, 2.1, 2)}${dot(17, 17, 1.6, 3)}
    </svg>`;
  veil.createDiv({ cls: "sg-gveil-name", text: p.name });
  const sub = veil.createDiv({ cls: "sg-gveil-sub", text: "gathering the pages…" });
  let gone = false;
  const lower = () => {
    if (gone) return;
    gone = true;
    veil.addClass("sg-gveil-out");
    window.setTimeout(() => veil.remove(), 500);
  };
  veil.onclick = lower;   // tap to dive in early — your GPU, your call
  return { sub, lower };
}

// ----------------------------------------------------------------- opening

/** write the curated config, then open a FRESH graph view on it — plus a
 * belt-and-suspenders push straight into the engine once it exists, and a
 * veil over the top until the node count stops moving */
export async function openGraphPreset(app: App, p: GraphPreset): Promise<void> {
  const opts = optionsFor(p);
  const cfg = `${app.vault.configDir}/graph.json`;
  try {
    // whatever was hand-tuned survives as graph.json.bak — one-level undo
    const prev = await app.vault.adapter.read(cfg);
    await app.vault.adapter.write(`${cfg}.bak`, prev);
  } catch { /* nothing there yet: nothing to save */ }
  try {
    await app.vault.adapter.write(cfg, JSON.stringify(opts, null, 2));
  } catch { /* the engine push below still applies the preset */ }
  // navigation rule: the graph REPLACES the current page — the back arrow
  // returns to the shelf — and never mints a tab. Stray graph tabs from
  // before fold away first so the fresh config is the only graph alive.
  const leaf = app.workspace.getLeaf(false);
  for (const l of app.workspace.getLeavesOfType("graph")) {
    if (l !== leaf) l.detach();
  }
  await leaf.setViewState({ type: "graph", active: true });
  await app.workspace.revealLeaf(leaf);
  const host = (leaf.view as unknown as { containerEl?: HTMLElement }).containerEl;
  const veil = host ? raiseVeil(host, p) : null;
  const push = (): boolean => {
    const view = leaf.view as unknown as {
      dataEngine?: { setOptions?: (o: unknown) => void };
      engine?: { setOptions?: (o: unknown) => void };
    } | undefined;
    const engine = view?.dataEngine ?? view?.engine;   // global graph = .dataEngine
    if (engine?.setOptions) { engine.setOptions(opts); return true; }
    return false;
  };
  if (!push()) {
    window.setTimeout(push, 300);
    window.setTimeout(push, 900);
    window.setTimeout(push, 2000);
  }
  if (veil) watchSettle(leaf, p, veil);
}

/** lower the veil once the web has actually settled: the renderer's node
 * count has to sit still for three straight looks AND the weight's minimum
 * settle time must have passed — with a hard cap so a stall never wedges
 * the view shut */
function watchSettle(leaf: WorkspaceLeaf, p: GraphPreset,
  veil: { sub: HTMLElement; lower: () => void }): void {
  const t0 = Date.now();
  let lastN = -1;
  let still = 0;
  const tick = window.setInterval(() => {
    const alive = (leaf.view as unknown as { containerEl?: HTMLElement })
      .containerEl?.isConnected;
    if (!alive) { window.clearInterval(tick); veil.lower(); return; }
    const r = (leaf.view as unknown as {
      renderer?: { nodes?: unknown[] };
    }).renderer;
    const n = r?.nodes?.length ?? 0;
    if (n > 0) {
      veil.sub.setText(`${n.toLocaleString()} pages settling — tap to dive in`);
      still = n === lastN ? still + 1 : 0;
    }
    lastN = n;
    const settled = still >= 3 && Date.now() - t0 >= SETTLE_MS[p.weight];
    if (settled || Date.now() - t0 > VEIL_CAP_MS) {
      window.clearInterval(tick);
      veil.lower();
      if (n === 0 && Date.now() - t0 > VEIL_CAP_MS) {
        new Notice("The graph is taking its time — it may still be filtering.");
      }
    }
  }, 350);
}
