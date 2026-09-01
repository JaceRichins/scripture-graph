/** 🧭 Leaf history, done by hand.
 *
 * Obsidian records tab history when FILES open (that's why the back
 * arrow works after normal note navigation) — but a raw setViewState()
 * swap records nothing, which left the navbar's back arrow dead after
 * opening the Library, Timeline, Reader or a graph preset. Every
 * plugin-driven page swap calls recordHistory() first, pushing the
 * page being left onto the leaf's own back stack — the same stack
 * Obsidian's arrows walk. */
interface LeafInternals {
  getHistoryState?: () => unknown;
  getViewState?: () => unknown;
  history?: { backHistory: unknown[]; forwardHistory: unknown[] };
  view?: { getViewType?: () => string; getEphemeralState?: () => unknown };
}

/** push the leaf's CURRENT page onto its back history — call immediately
 * before a setViewState() that replaces it. Accepts any leaf-shaped
 * object so shim-typed callers (studyBar's workspace cast) fit too. */
export function recordHistory(leaf: unknown): void {
  const l = leaf as LeafInternals;
  const h = l.history;
  if (!h?.backHistory) return;
  const type = l.view?.getViewType?.() ?? "empty";
  if (type === "empty") return;              // a blank tab isn't a place
  // native entry shape when available; hand-built twin otherwise
  const hs = l.getHistoryState?.()
    ?? { state: l.getViewState?.() ?? {}, eState: l.view?.getEphemeralState?.() ?? {} };
  h.backHistory.push(hs);
  h.forwardHistory.length = 0;               // a new road forks the future off
}
