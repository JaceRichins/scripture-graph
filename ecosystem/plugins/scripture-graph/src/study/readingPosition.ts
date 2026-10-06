/** Custom workspace pages participate in Obsidian's native ephemeral history. */
export type Position = { top: number; left: number; anchor?: { tag: string; text: string; offset: number }; mark?: { id: string; offset: number } };
interface PageView {
  contentEl: HTMLElement;
  getEphemeralState(): unknown;
  setEphemeralState(state: unknown): unknown;
  setState(...args: any[]): unknown;
  onClose(): unknown;
}
const key = 'sgReadingPosition';
const headings = 'h1,h2,h3,p,li,.cm-line';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const tagOf = (el: HTMLElement) => el.classList?.contains('cm-line') ? 'cm-line' : el.tagName.toLowerCase();
const selector = (tag: string) => tag === 'cm-line' ? '.cm-line' : tag;
/** The reader's place in the text itself: the verse, or a study page's block. */
const markOf = (el: HTMLElement): string | null =>
  el.closest<HTMLElement>('[data-verse-id]')?.getAttribute('data-verse-id')
  ?? el.closest<HTMLElement>('[data-sg-study-block][data-sg-doc-anchor]')?.getAttribute('data-sg-doc-anchor')
  ?? null;
const quoted = (value: string) => value.replace(/["\\]/g, m => `\\${m}`);
/** Moving the page is the reader taking over; touching it only counts once the page has arrived. */
const MOVED = ['wheel', 'touchmove', 'keydown'];
const TOUCHED = ['touchstart', 'pointerdown'];

export function captureReadingPosition(root: HTMLElement): Position {
  const position: Position = { top: root.scrollTop, left: root.scrollLeft };
  if (position.top < 1) return position;
  const bounds = root.getBoundingClientRect();
  const visible = Array.from(root.querySelectorAll<HTMLElement>(headings)).find(el => {
    const r = el.getBoundingClientRect();
    return r.bottom > bounds.top + 4 && r.top < bounds.bottom && !!el.textContent?.trim();
  });
  if (!visible) return position;
  const offset = visible.getBoundingClientRect().top - bounds.top;
  position.anchor = { tag: tagOf(visible), text: visible.textContent!.trim().slice(0, 200), offset };
  const id = markOf(visible);
  if (id) position.mark = { id, offset };
  return position;
}

/** Aim for the verse first, then the remembered wording, then the raw offset.
 * The first two are measured live, so they hold through a font-size, spacing or
 * theme change; the offset is only the last resort. */
function seek(root: HTMLElement, position: Position): { el: HTMLElement; offset: number } | null {
  const mark = position.mark;
  if (mark && typeof mark.id === 'string' && mark.id && Number.isFinite(mark.offset)) {
    const el = root.querySelector<HTMLElement>(`[data-verse-id="${quoted(mark.id)}"],[data-sg-doc-anchor="${quoted(mark.id)}"]`);
    if (el) return { el, offset: mark.offset };
  }
  const anchor = position.anchor;
  if (anchor && /^(h[1-6]|p|li|cm-line)$/.test(anchor.tag) && typeof anchor.text === 'string' && Number.isFinite(anchor.offset)) {
    const el = Array.from(root.querySelectorAll<HTMLElement>(selector(anchor.tag))).find(e => e.textContent?.trim().slice(0, 200) === anchor.text);
    if (el) return { el, offset: anchor.offset };
  }
  return null;
}

/** Wait for async Markdown/images. Stop as soon as the reader moves the page.
 * `done` is called once, however it ends, so a caller can tell when the page is
 * the reader's again. */
export function restoreReadingPosition(root: HTMLElement, raw: unknown, done?: () => void): () => void {
  const p = record(raw);
  if (typeof p.top !== 'number' || !Number.isFinite(p.top) || p.top < 0 || typeof p.left !== 'number' || !Number.isFinite(p.left)) { done?.(); return () => {}; }
  const position = p as Position;
  let stopped = false, frame = 0, landed = false;
  const cancel = () => {
    if (stopped) return; stopped = true;
    cancelAnimationFrame(frame); clearTimeout(timer); clearInterval(poll); observer.disconnect(); resize.disconnect();
    for (const event of MOVED) root.removeEventListener(event, cancel, true);
    for (const event of TOUCHED) root.removeEventListener(event, arrive, true);
    done?.();
  };
  // A finger resting on the page while it opens is not yet reading: only once
  // the page has reached its place does a touch mean the reader has taken over.
  const arrive = () => { if (landed) cancel(); };
  const apply = () => {
    frame = 0; if (stopped || !root.isConnected) return;
    const hit = seek(root, position);
    const want = Math.max(0, hit ? root.scrollTop + hit.el.getBoundingClientRect().top - root.getBoundingClientRect().top - hit.offset : position.top);
    root.scrollTop = want; root.scrollLeft = position.left;
    if (Math.abs(root.scrollTop - want) <= 2 && (hit || !position.mark)) landed = true;
    for (const child of Array.from(root.children)) resize.observe(child);
  };
  const schedule = () => { if (!stopped && !frame) frame = requestAnimationFrame(apply); };
  const observer = new MutationObserver(schedule);
  const resize = new ResizeObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, characterData: true }); resize.observe(root);
  // A page that renders its passage in place — the same elements, new text —
  // changes neither size nor structure, and a long chapter renders the part it
  // was asked to show. Neither raises an observer, so the aim is also retaken
  // on a timer until it holds.
  const poll = setInterval(schedule, 120);
  for (const event of MOVED) root.addEventListener(event, cancel, { capture: true, passive: true });
  for (const event of TOUCHED) root.addEventListener(event, arrive, { capture: true, passive: true });
  const timer = setTimeout(cancel, 8000);
  schedule();
  return cancel;
}

/** Install before the page first enters a tab; keep native ephemeral fields intact. */
export function rememberReadingPosition<T extends { contentEl: HTMLElement }>(original: T): T {
  const view = original as unknown as PageView;
  const get = view.getEphemeralState.bind(view), set = view.setEphemeralState.bind(view);
  const change = view.setState.bind(view), close = view.onClose.bind(view);
  let cancel = () => {};
  view.getEphemeralState = () => ({ ...record(get()), [key]: captureReadingPosition(view.contentEl) });
  view.setEphemeralState = state => {
    const result = set(state); cancel();
    if (record(state)[key]) cancel = restoreReadingPosition(view.contentEl, record(state)[key]);
    return result;
  };
  view.setState = (...args) => { cancel(); return change(...args); };
  view.onClose = () => { cancel(); return close(); };
  return original;
}
