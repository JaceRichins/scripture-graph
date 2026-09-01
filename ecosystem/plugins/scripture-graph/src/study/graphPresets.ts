/** 🕸 Graph presets — the 75,000-connection graph, pre-filtered.
 *
 * The full vault graph is beautiful and unusable: 10k+ nodes flatten the
 * GPU. Each preset writes a curated graph.json (path-scoped search filter,
 * color groups, calm display and forces) and opens a FRESH graph view on
 * it — so the graph arrives already tamed: hundreds of nodes, not
 * thousands, tags and attachments off, orphans hidden, sane zoom. The
 * config you had is saved to graph.json.bak first, so a hand-tuned setup
 * is one file-rename from coming back. */
import { Notice, type App } from "obsidian";
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
}

export const GRAPH_PRESETS: GraphPreset[] = [
  {
    id: "christ", icon: "graph", name: "Names of Christ",
    desc: "Every page that speaks His name — one color per title",
    weight: "medium",
    search: `Jesus OR Christ OR Messiah OR Jehovah OR Immanuel OR "Son of God" OR "Lamb of God" OR "Son of Man" OR Redeemer OR Savior`,
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
  },
];

const hexToInt = (hex: string): number => parseInt(hex.replace("#", ""), 16);

/** the perf floor every preset stands on */
function optionsFor(p: GraphPreset): Record<string, unknown> {
  return {
    "collapse-filter": true,
    search: p.search,
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
  };
}

/** write the curated config, then open a FRESH graph view on it — plus a
 * belt-and-suspenders push straight into the engine once it exists */
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
  if (p.weight === "heavy") {
    new Notice("The whole vault at once — give it a few seconds to settle.");
  }
  // a fresh view reads the fresh config
  for (const l of app.workspace.getLeavesOfType("graph")) l.detach();
  const leaf = app.workspace.getLeaf(true);
  await leaf.setViewState({ type: "graph", active: true });
  await app.workspace.revealLeaf(leaf);
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
}
