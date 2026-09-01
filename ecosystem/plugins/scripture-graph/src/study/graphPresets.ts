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
import { recordHistory } from "./leafNav";
import { type NavIconName } from "./navIcons";
import { trace } from "./trace";

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
 * when zoomed way in, and lines slim down. The forces tighten too:
 * shorter springs, stronger center, gentler repel — the web pulls
 * together in seconds instead of drifting for a minute (the log showed a
 * 43-second wander on an iPhone before these). */
const MOBILE_FLOOR: Record<string, unknown> = {
  textFadeMultiplier: -1.6,
  lineSizeMultiplier: 0.45,
  linkDistance: 110,
  centerStrength: 0.6,
  repelStrength: 9,
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
/** once nodes are VISIBLE, hand over even if physics still drift — the
 * fragile first seconds are covered, the rest is watchable */
const HANDOVER_MS = 6000;
/** filtering a 10k-file vault can genuinely take a while on a phone —
 * the veil waits it out (the ✕ is right there) instead of dropping you
 * onto a blank churning view */
const EMPTY_MAX_MS = 30000;
const SLOW_NOTE_MS = 8000;

interface Veil {
  sub: HTMLElement;
  lower: () => void;
  cancelled: () => boolean;
  /** the ✕ runs this (after lowering) once the opener knows how to go back */
  onCancel: (fn: () => void) => void;
}

interface GraphEngine {
  setOptions?: (o: unknown) => void;
  /** debounced search applier — setOptions stores the query, THIS runs it */
  requestUpdateSearch?: { run?: () => void };
}

/** a phone should never be asked to draw this many nodes — if a filter
 * ever fails to take again, back out instead of letting the GPU die */
const MOBILE_PANIC_NODES = 4500;

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
  // VERIFIED in Obsidian's own app.js: a graph view's onload copies
  // internalPlugins("graph").instance.options into its engine and runs
  // requestUpdateSearch — graph.json is only read at app START. v0.51
  // wrote the file and left the stale in-memory options winning, which
  // handed a phone all 10,037 nodes. The INSTANCE is the config.
  const inst = (app as unknown as {
    internalPlugins?: { getPluginById?: (id: string) =>
      { instance?: { options?: Record<string, unknown>; saveOptions?: () => void } } | null };
  }).internalPlugins?.getPluginById?.("graph")?.instance;
  if (inst) {
    inst.options = Object.assign({}, inst.options, opts);
    try { inst.saveOptions?.(); } catch { /* persistence is best-effort */ }
  }
  if (veil.cancelled()) { trace("gpreset.cancel", { id: p.id, at: "write" }); return; }
  trace("gpreset.open", { id: p.id, mobile: Platform.isMobile, inst: !!inst });
  // navigation rule: the graph REPLACES the current page — the back arrow
  // returns to the shelf — and never mints a tab. Stray graph tabs from
  // before fold away first so the fresh config is the only graph alive.
  const leaf = app.workspace.getLeaf(false);
  for (const l of app.workspace.getLeavesOfType("graph")) {
    if (l !== leaf) l.detach();
  }
  // setViewState to the SAME view type is a silent no-op (the log's
  // "couldn't render again"): when we're already on a graph, skip it and
  // let the engine push below re-filter the live view in place — that's
  // also the fastest path, no view rebuild, no cache reload.
  const already = (leaf.view as { getViewType?: () => string } | undefined)
    ?.getViewType?.() === "graph";
  if (!already) {
    recordHistory(leaf);   // the page being left is one back-arrow away
    await leaf.setViewState({ type: "graph", active: true });
  }
  await app.workspace.revealLeaf(leaf);
  // once a view exists, escape = back the way you came
  veil.onCancel(() => goBack(leaf));
  if (veil.cancelled()) { goBack(leaf); return; }
  // hammer the options in on a tight loop until the engine exists — and
  // ALWAYS chase setOptions with requestUpdateSearch.run(): setOptions
  // stores the search string but only that runner applies the filter
  // (Obsidian's own view onload does exactly this pair)
  const t0 = Date.now();
  const pushTick = window.setInterval(() => {
    const view = leaf.view as unknown as {
      dataEngine?: GraphEngine;
      engine?: GraphEngine;
    } | undefined;
    const engine = view?.dataEngine ?? view?.engine;   // global graph = .dataEngine
    if (engine?.setOptions) {
      engine.setOptions(opts);
      engine.requestUpdateSearch?.run?.();
      window.clearInterval(pushTick);
      trace("gpreset.opts-applied", { id: p.id, ms: Date.now() - t0 });
    } else if (Date.now() - t0 > 3200) window.clearInterval(pushTick);
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
 * anti-flash floor. While the filter is still resolving (no nodes yet)
 * the veil WAITS — up to 30s, ✕ always live — because dropping early
 * onto a blank churning view is what felt broken. Once nodes exist, the
 * handover cap stops a long physics drift from holding you hostage. */
function watchSettle(leaf: WorkspaceLeaf, p: GraphPreset, veil: Veil): void {
  const t0 = Date.now();
  let lastN = -1;
  let still = 0;
  let nodesAt: number | null = null;
  let slowNoted = false;
  const done = (why: string, n: number) => {
    veil.lower();
    trace("gpreset.done", { id: p.id, why, n, ms: Date.now() - t0 });
  };
  const tick = window.setInterval(() => {
    if (veil.cancelled()) {
      window.clearInterval(tick);
      trace("gpreset.cancel", { id: p.id, at: "settle", ms: Date.now() - t0 });
      return;
    }
    const alive = (leaf.view as unknown as { containerEl?: HTMLElement })
      .containerEl?.isConnected;
    if (!alive) { window.clearInterval(tick); done("view-gone", lastN); return; }
    const r = (leaf.view as unknown as {
      renderer?: { nodes?: unknown[] };
    }).renderer;
    const n = r?.nodes?.length ?? 0;
    const ms = Date.now() - t0;
    if (Platform.isMobile && n > MOBILE_PANIC_NODES) {
      // the filter didn't take (or a preset is mis-scoped) — this is the
      // exact failure that froze the iPhone; bail out, don't render it
      window.clearInterval(tick);
      veil.lower();
      goBack(leaf);
      new Notice("That graph came back far too big for a phone — backed out safely.");
      trace("gpreset.panic", { id: p.id, n, ms });
      return;
    }
    if (n > 0) {
      if (nodesAt === null) {
        nodesAt = Date.now();
        trace("gpreset.first-nodes", { id: p.id, n, ms });
      }
      veil.sub.setText(`${n.toLocaleString()} pages settling`);
      still = n === lastN ? still + 1 : 0;
    } else if (!slowNoted && ms > SLOW_NOTE_MS) {
      slowNoted = true;
      veil.sub.setText("still filtering — this one is big");
    }
    lastN = n;
    if (still >= 2 && ms >= SETTLE_MS[p.weight]) {
      window.clearInterval(tick); done("settled", n); return;
    }
    if (nodesAt !== null && Date.now() - nodesAt > HANDOVER_MS) {
      window.clearInterval(tick); done("handover", n); return;
    }
    if (nodesAt === null && ms > EMPTY_MAX_MS) {
      window.clearInterval(tick);
      done("empty-cap", 0);
      new Notice("The graph never filled in — ✕ or the back arrow returns to the shelf.");
    }
  }, 150);
}
