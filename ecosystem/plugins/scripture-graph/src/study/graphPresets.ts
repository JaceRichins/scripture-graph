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

/** anti-flash floors only — the veil lifts the moment the web is actually
 * still, these just keep a fast graph from strobing */
const SETTLE_MS = { light: 450, medium: 700, heavy: 1000 } as const;
const VEIL_CAP_MS = 8000;

interface Veil {
  sub: HTMLElement;
  lower: () => void;
  cancelled: () => boolean;
  /** the ✕ runs this (after lowering) once the opener knows how to go back */
  onCancel: (fn: () => void) => void;
}

/** The Graphs-shelf icon come alive, floating over the graph itself: the
 * center stays see-through so the web visibly assembles beneath the
 * constellation, dots glowing in the preset's own colors. Lives on
 * document.body so it renders the INSTANT the preset is tapped — before
 * any file or view work. It eats touches while physics settle (panning
 * mid-settle is what crashes phones); a tap dives in early, the ✕ is the
 * escape hatch when a graph is taking too long. */
function raiseVeil(p: GraphPreset): Veil {
  const veil = document.body.createDiv({ cls: "sg-gveil" });
  const hexes = p.groups.length ? p.groups.map(g => g.hex) : ["#8fb8ff"];
  const dot = (cx: number, cy: number, r: number, i: number) =>
    `<circle class="sg-gveil-dot" cx="${cx}" cy="${cy}" r="${r}"`
    + ` fill="${hexes[i % hexes.length]}"`
    + ` style="color:${hexes[i % hexes.length]};animation-delay:${i * 0.22}s"/>`;
  // static, plugin-authored markup — no vault data anywhere near it
  veil.createDiv({ cls: "sg-gveil-art" }).innerHTML =
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path class="sg-gveil-lines" d="M8.2 7.4 16 8.2M7 8.7l1.2 7.2M10.5 17.4l4.9-.3M15.9 9.9l.7 5.4"/>
      ${dot(6, 6.5, 2.4, 0)}${dot(18, 8.5, 2, 1)}${dot(8.5, 18, 2.1, 2)}${dot(17, 17, 1.6, 3)}
    </svg>`;
  veil.createDiv({ cls: "sg-gveil-name", text: p.name });
  const sub = veil.createDiv({ cls: "sg-gveil-sub", text: "opening the graph…" });
  veil.createDiv({ cls: "sg-gveil-hint", text: "tap anywhere to dive in early" });
  let gone = false;
  let wasCancelled = false;
  let cancelAction: () => void = () => { /* pre-view cancel: just stop */ };
  const lower = () => {
    if (gone) return;
    gone = true;
    veil.addClass("sg-gveil-out");
    window.setTimeout(() => veil.remove(), 400);
  };
  const x = veil.createEl("button", { cls: "sg-gveil-x", text: "✕" });
  x.setAttr("aria-label", "Cancel");
  x.onclick = (e) => {
    e.stopPropagation();
    wasCancelled = true;
    lower();
    cancelAction();
  };
  veil.onclick = lower;   // dive in early — your GPU, your call
  return { sub, lower, cancelled: () => wasCancelled,
    onCancel: fn => { cancelAction = fn; } };
}

// ----------------------------------------------------------------- opening

/** Veil FIRST — the tap answers instantly — then the curated config is
 * written and a graph view opened on it, options pushed straight into the
 * engine the moment it exists. The veil lifts when the node count sits
 * still; the ✕ aborts (before the view exists) or walks back to the shelf
 * (after). */
export async function openGraphPreset(app: App, p: GraphPreset): Promise<void> {
  const veil = raiseVeil(p);
  const opts = optionsFor(p);
  const cfg = `${app.vault.configDir}/graph.json`;
  try {
    // whatever was hand-tuned survives as graph.json.bak — one-level undo
    const prev = await app.vault.adapter.read(cfg);
    await app.vault.adapter.write(`${cfg}.bak`, prev);
  } catch { /* nothing there yet: nothing to save */ }
  try {
    // written BEFORE the view opens so the engine's first read is already
    // the filtered set — never a 10k-node false start
    await app.vault.adapter.write(cfg, JSON.stringify(opts, null, 2));
  } catch { /* the engine push below still applies the preset */ }
  if (veil.cancelled()) return;   // escaped while writing: nothing opened
  // navigation rule: the graph REPLACES the current page — the back arrow
  // returns to the shelf — and never mints a tab. Stray graph tabs from
  // before fold away first so the fresh config is the only graph alive.
  const leaf = app.workspace.getLeaf(false);
  for (const l of app.workspace.getLeavesOfType("graph")) {
    if (l !== leaf) l.detach();
  }
  await leaf.setViewState({ type: "graph", active: true });
  await app.workspace.revealLeaf(leaf);
  // once a view exists, escape = back the way you came
  veil.onCancel(() => goBack(leaf));
  if (veil.cancelled()) { goBack(leaf); return; }
  // hammer the options in on a tight loop until the engine exists — the
  // sooner they land, the sooner physics runs on the FILTERED set
  const t0 = Date.now();
  const pushTick = window.setInterval(() => {
    const view = leaf.view as unknown as {
      dataEngine?: { setOptions?: (o: unknown) => void };
      engine?: { setOptions?: (o: unknown) => void };
    } | undefined;
    const engine = view?.dataEngine ?? view?.engine;   // global graph = .dataEngine
    if (engine?.setOptions) { engine.setOptions(opts); window.clearInterval(pushTick); }
    else if (Date.now() - t0 > 3200) window.clearInterval(pushTick);
  }, 80);
  watchSettle(leaf, p, veil);
}

/** back the way the user came: the leaf's own history if it has any,
 * otherwise the Library page (its stable view id — importing the const
 * from libraryView would be a require cycle) */
function goBack(leaf: WorkspaceLeaf): void {
  const hist = (leaf as unknown as {
    history?: { back?: () => void; backHistory?: unknown[] };
  }).history;
  if (hist?.back && (hist.backHistory?.length ?? 0) > 0) hist.back();
  else void leaf.setViewState({ type: "sg-library", active: true });
}

/** lower the veil the moment the web is actually still: the renderer's
 * node count unchanged for two straight looks (150ms apart), past a small
 * anti-flash floor — with a hard cap so a stall never wedges the view
 * shut */
function watchSettle(leaf: WorkspaceLeaf, p: GraphPreset, veil: Veil): void {
  const t0 = Date.now();
  let lastN = -1;
  let still = 0;
  const tick = window.setInterval(() => {
    if (veil.cancelled()) { window.clearInterval(tick); return; }
    const alive = (leaf.view as unknown as { containerEl?: HTMLElement })
      .containerEl?.isConnected;
    if (!alive) { window.clearInterval(tick); veil.lower(); return; }
    const r = (leaf.view as unknown as {
      renderer?: { nodes?: unknown[] };
    }).renderer;
    const n = r?.nodes?.length ?? 0;
    if (n > 0) {
      veil.sub.setText(`${n.toLocaleString()} pages settling`);
      still = n === lastN ? still + 1 : 0;
    }
    lastN = n;
    const settled = still >= 2 && Date.now() - t0 >= SETTLE_MS[p.weight];
    if (settled || Date.now() - t0 > VEIL_CAP_MS) {
      window.clearInterval(tick);
      veil.lower();
      if (n === 0 && Date.now() - t0 > VEIL_CAP_MS) {
        new Notice("The graph is taking its time — it may still be filtering.");
      }
    }
  }, 150);
}
