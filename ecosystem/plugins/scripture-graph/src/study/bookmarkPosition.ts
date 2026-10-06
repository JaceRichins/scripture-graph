import { captureReadingPosition, restoreReadingPosition, type Position } from './readingPosition';

/** Positions are personal device data, keyed by account AND bookmark identity. */
export interface BookmarkPositionHost {
  page(): string | null;
  root(): HTMLElement | null;
  bookmark(page: string): Promise<string | null>;
  read(key: string): Promise<Position | null>;
  write(key: string, position: Position): Promise<void>;
  /** the place at a page change, close or app backgrounding — kept with the bookmark itself */
  persist?(key: string, position: Position): void;
}
export interface BookmarkPageView {
  containerEl: HTMLElement;
  setState(...args: any[]): any;
  setEphemeralState(...args: any[]): any;
  onClose(...args: any[]): any;
}

/** Follow the reading surface, not sheets, textareas or embedded scroll areas. */
export function trackBookmarkPosition(view: BookmarkPageView, host: BookmarkPositionHost) {
  let page: string | null = null, storageKey: string | null = null;
  let generation = 0, disposed = false, loading = false, explicit = false, touched = false;
  let cancelRestore = () => {}, pending: Position | null = null, latest: Position | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined, restoring = 0;
  // A page still on its way back to the reader's place is not a place to save:
  // the scrolls it makes are ours, and a half-rendered chapter would overwrite
  // a good bookmark with the top of itself.
  const stop = () => { restoring = 0; cancelRestore(); cancelRestore = () => {}; };
  const save = () => {
    clearTimeout(timer);
    if (storageKey && pending) void host.write(storageKey, pending).catch(() => {});
    pending = null;
  };
  // Scrolling writes the device copy (debounced); leaving writes the synced copy once.
  const keep = () => {
    if (storageKey && latest) { try { host.persist?.(storageKey, latest); } catch { /* the device copy remains */ } }
    latest = null;
  };
  const capture = () => {
    const root = host.root();
    if (!loading && !restoring && storageKey && root?.clientHeight && page === host.page()) {
      pending = latest = captureReadingPosition(root);
      clearTimeout(timer); timer = setTimeout(save, 250);
    }
  };
  // While the page is still finding its bookmark, a scroll away from the top is
  // the reader's own: they have taken over and must not be moved afterwards.
  // (Opening a page scrolls it back to the top; that is the page, not a reader.)
  const scroll = (event: Event) => {
    const root = host.root();
    if (event.target !== root) return;
    if (loading && root!.scrollTop > 1) interact();
    capture();
  };
  const interact = () => { touched = true; stop(); };
  view.containerEl.addEventListener('scroll', scroll, true);
  for (const event of ['touchmove', 'wheel', 'keydown']) view.containerEl.addEventListener(event, interact, true);

  /** The surface a page is read on can arrive after the page itself: a preview
   * Obsidian has still to build, or a chapter switching out of editing. Give it
   * time rather than resuming at the top because it was not there yet. */
  const surface = async (token: number, openingPage: string): Promise<HTMLElement | null> => {
    for (let wait = 0; wait < 40; wait++) {
      const root = host.root();
      if (root?.clientHeight) return root;
      await new Promise(resolve => setTimeout(resolve, 150));
      if (disposed || token !== generation || openingPage !== host.page() || explicit || touched) return null;
    }
    return null;
  };
  const begin = async (captureNow = false) => {
    save(); keep(); stop();
    const token = ++generation;
    page = host.page(); storageKey = null;
    if (!page) { loading = false; return; }
    const openingPage = page;
    loading = true;
    try {
      const key = await host.bookmark(page);
      const position = key && !captureNow ? await host.read(key) : null;
      if (disposed || token !== generation || openingPage !== host.page()) return;
      storageKey = key;
      if (captureNow) { loading = false; capture(); save(); return; }
      if (!position || explicit || touched) { loading = false; return; }
      const root = host.root()?.clientHeight ? host.root() : await surface(token, openingPage);
      loading = false;
      if (!root || disposed || token !== generation || openingPage !== host.page() || explicit || touched) return;
      restoring = token;
      cancelRestore = restoreReadingPosition(root, position, () => { if (restoring === token) restoring = 0; });
    } catch { if (token === generation) loading = false; }
  };
  const change = view.setState, ephemeral = view.setEphemeralState, close = view.onClose;
  const wrappedChange = async function(this: BookmarkPageView, ...args: any[]) {
    capture(); save(); keep(); stop();
    const token = ++generation;
    const incoming = args[0];
    const samePage = incoming && typeof incoming === 'object' && (incoming.file ?? incoming.path) === host.page();
    loading = true;
    // Obsidian can change a chapter from editing to preview after opening it.
    // That mode change must not forget a verse link or an already-started scroll.
    if (!samePage) { explicit = false; touched = false; }
    const result = await change.apply(this, args);
    if (!disposed && token === generation) await begin();
    return result;
  };
  const wrappedEphemeral = function(this: BookmarkPageView, ...args: any[]) {
    const state = args[0] ?? {};
    // Explicit references and native Back/Forward positions take precedence.
    if (state.subpath || state.sgReadingPosition || state.line != null || state.scroll != null || state.cursor) {
      explicit = true; stop();
    }
    return ephemeral.apply(this, args);
  };
  const dispose = () => {
    if (disposed) return;
    capture(); save(); keep(); disposed = true; ++generation; stop();
    view.containerEl.removeEventListener('scroll', scroll, true);
    for (const event of ['touchmove', 'wheel', 'keydown']) view.containerEl.removeEventListener(event, interact, true);
    if (view.setState === wrappedChange) view.setState = change;
    if (view.setEphemeralState === wrappedEphemeral) view.setEphemeralState = ephemeral;
    if (view.onClose === wrappedClose) view.onClose = close;
  };
  const wrappedClose = function(this: BookmarkPageView, ...args: any[]) { dispose(); return close.apply(this, args); };
  view.setState = wrappedChange; view.setEphemeralState = wrappedEphemeral; view.onClose = wrappedClose;
  void begin();
  return {
    dispose,
    refresh: () => begin(true),
    check: () => { if (!disposed && page !== host.page()) { explicit = false; touched = false; void begin(); } },
    flush: () => { capture(); save(); keep(); },
  };
}
