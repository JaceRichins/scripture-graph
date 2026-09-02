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
  /** phone-sized substitutes: a narrower search, scan-free color groups,
   * harsher display floors, and the honest one-liner the shelf shows
   * instead of `desc` */
  mobile?: { search?: string; groups?: { query: string; hex: string }[];
    extra?: Record<string, unknown>; note?: string };
}

/** the titles of Christ, matched against FILENAMES. `file:` never reads a
 * file's contents, so this resolves in milliseconds where the equivalent
 * content search walks all 10,000+ pages and stalls for minutes. */
const CHRIST_NAMES =
  `file:Jesus OR file:Christ OR file:Messiah OR file:Jehovah OR file:Immanuel OR file:"Son of God" OR file:"Lamb of God" OR file:"Son of Man" OR file:Redeemer OR file:Savior`;

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "christ", icon: "graph", name: "Names of Christ",
    desc: "Every page that bears His name — one color per title",
    weight: "light",
    // NEVER content words. A content query makes the engine READ every
    // file in the vault (10k+) before it can draw a single node — that
    // was minutes on a phone AND on a laptop. `file:` matches names
    // only: no reads, effectively instant. The 200-odd pages that BEAR a
    // title of Christ — the entity page, gospel topics, dictionary
    // entries, conference talks — are the constellation worth seeing.
    search: CHRIST_NAMES,
    // color groups ride the SAME query pipeline (updateSearch concats
    // them into setQuery, and requiredInputs merge across ALL queries),
    // so one content-word group would re-trigger the full-vault read.
    groups: [
      { query: "file:Jesus", hex: "#e05252" },
      { query: "file:Christ", hex: "#e0b152" },
      { query: "file:Messiah", hex: "#b1e052" },
      { query: "file:Jehovah", hex: "#52e052" },
      { query: "file:Immanuel", hex: "#52e0b1" },
      { query: `file:"Son of God"`, hex: "#52b1e0" },
      { query: `file:"Son of Man"`, hex: "#5252e0" },
      { query: "file:Savior", hex: "#b152e0" },
    ],
    extra: { scale: 0.22 },
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

/** THE RAIL: a query with no `path:`/`file:`/`tag:` prefix is a CONTENT
 * search, and a content search makes Obsidian read every file in the
 * vault before it can draw anything — minutes on a phone, minutes on a
 * laptop. Every preset query must be scan-free; this shouts in the debug
 * log the moment one is not, so the mistake can never ship quietly. */
function assertScanFree(p: GraphPreset, q: string): void {
  const bare = q.trim().length > 0
    && !/(path|file|tag|line|section|block|content)\s*:/i.test(q);
  if (bare) trace("gpreset.SLOW-QUERY", { id: p.id, q: q.slice(0, 60) });
}

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
  const groups = (mobile && p.mobile?.groups) || p.groups;
  const search = (mobile && p.mobile?.search) || p.search;
  assertScanFree(p, search);
  for (const g of groups) assertScanFree(p, g.query);
  return {
    "collapse-filter": true,
    search,
    showTags: false,
    showAttachments: false,
    hideUnresolved: true,
    showOrphans: false,
    "collapse-color-groups": true,
    colorGroups: groups.map(g => ({ query: g.query, color: { a: 1, rgb: hexToInt(g.hex) } })),
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
 * onto a blank churning view. While the engine's scan queue is ALIVE the
 * empty-cap doesn't run at all (a full-text query provably takes >30s on
 * a phone); the ceiling is the absolute end of patience. */
const EMPTY_MAX_MS = 30000;
const CEILING_MS = 120000;
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
  /** non-null while the engine's file-scan queue is still working — a
   * content-word query reads every file in the vault through this */
  queue?: unknown;
  /** builds the node set from metadataCache and hands it to the renderer */
  render?: () => void;
  /** parses the filter + color queries; the first call is what turns
   * "no filter yet" into "filtered" */
  setQuery?: (q: unknown) => void;
}

/** 🛑 The unfiltered first frame — the real phone-killer.
 *
 * Read from Obsidian's app.js: a graph view's onload runs
 * `dataEngine.setOptions(options)` and THEN `requestUpdateSearch.run()`.
 * But setOptions ends with `this.render()`, and at that instant no query
 * has been parsed (`searchQueries` is still null) — so render() draws the
 * ENTIRE vault: 10,000 nodes and 75,000 links built on the main thread
 * and posted to the physics worker. One line later the filter parses,
 * the next render is (rightly) empty, and setData tears every one of
 * those back down with Array.remove — Obsidian's remove is a full
 * backward scan + splice per call, 75,000 times over a 75,000-element
 * array. Benchmarked at this vault's size, that teardown did not finish
 * in two minutes on the laptop; on a phone it is the frozen veil that
 * never lifts — and, before the panic rail, the crash. All of it happens
 * synchronously inside setViewState, so the veil can't even update.
 *
 * The cure is to never draw the unfiltered vault: hold render() from the
 * moment the engine exists until its first setQuery has parsed our
 * filter, then hand everything back to Obsidian untouched. Only ever
 * armed for a preset open, only for that one view. */
const HOLD_MAX_MS = 4000;
function holdFirstRender(view: unknown, id: string): void {
  const eng = (view as { dataEngine?: GraphEngine } | undefined)?.dataEngine;
  if (!eng?.render || !eng.setQuery) return;
  const e = eng as GraphEngine & Record<string, unknown>;
  let held = 0;
  let released = false;
  const t0 = Date.now();
  const release = (why: string) => {
    if (released) return;
    released = true;
    // own-property overrides gone → the prototype methods are back
    delete e.render;
    delete e.setQuery;
    trace("gpreset.first-render-held", { id, held, why, ms: Date.now() - t0 });
  };
  e.render = () => { held++; };
  e.setQuery = function (this: GraphEngine, q: unknown) {
    release("query");
    this.setQuery?.(q);
  };
  // a hold can't be allowed to stick: if no query ever parses, let go
  window.setTimeout(() => release("timeout"), HOLD_MAX_MS);
}

/** Obsidian builds the view inside setViewState via
 * `viewRegistry.viewByType[type](leaf)` — looked up at call time, which
 * is the one moment we can reach the engine BEFORE onload renders. Swap
 * the creator for the duration of the open, put it back after. */
async function openHeld(app: App, leaf: WorkspaceLeaf, id: string): Promise<void> {
  const reg = (app as unknown as {
    viewRegistry?: { viewByType?: Record<string, (l: WorkspaceLeaf) => unknown> };
  }).viewRegistry;
  const orig = reg?.viewByType?.graph;
  if (reg?.viewByType && orig) {
    reg.viewByType.graph = (l) => {
      const v = orig(l);
      holdFirstRender(v, id);
      return v;
    };
  }
  try {
    await leaf.setViewState({ type: "graph", active: true });
  } finally {
    if (reg?.viewByType && orig) reg.viewByType.graph = orig;
  }
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
  try {
    await openUnderVeil(app, p, veil);
  } catch (err) {
    // an orphaned veil is the one thing that must never happen — it reads
    // as "never renders" and leaves nothing but the ✕
    veil.lower();
    trace("gpreset.error", { id: p.id, err: String(err).slice(0, 120) });
    new Notice("Couldn't open that graph — the debug log has the reason.");
  }
}

async function openUnderVeil(app: App, p: GraphPreset, veil: Veil): Promise<void> {
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
    await openHeld(app, leaf, p.id);   // graph view, first render held
    const type = (leaf.view as { getViewType?: () => string } | undefined)
      ?.getViewType?.();
    if (type !== "graph") {
      // setViewState returns silently without swapping while the leaf is
      // mid-transition ("working") — say so instead of waiting on nothing
      trace("gpreset.no-view", { id: p.id, type: type ?? "?" });
      veil.lower();
      new Notice("The graph view didn't open — tap it once more.");
      return;
    }
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
    const v = leaf.view as unknown as {
      renderer?: { nodes?: unknown[] };
      dataEngine?: GraphEngine;
      engine?: GraphEngine;
    };
    const n = v.renderer?.nodes?.length ?? 0;
    const scanning = !!(v.dataEngine ?? v.engine)?.queue;
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
      veil.sub.setText(scanning
        ? "reading the vault for matches — big search"
        : "still filtering — this one is big");
    }
    lastN = n;
    // a live scan means results are still streaming in — don't judge yet
    if (still >= 2 && ms >= SETTLE_MS[p.weight] && !scanning) {
      window.clearInterval(tick); done("settled", n); return;
    }
    if (nodesAt !== null && Date.now() - nodesAt > HANDOVER_MS) {
      window.clearInterval(tick); done("handover", n); return;
    }
    if (nodesAt === null && ((ms > EMPTY_MAX_MS && !scanning) || ms > CEILING_MS)) {
      window.clearInterval(tick);
      done(scanning ? "ceiling" : "empty-cap", 0);
      goBack(leaf);   // an empty graph isn't a destination — return to the shelf
      new Notice("That graph never filled in — brought you back to the shelf.");
    }
  }, 150);
}
