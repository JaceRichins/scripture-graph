import type { TFile } from 'obsidian';
import type { Annotation } from '@scripture-graph/core-sdk';

export const BOOKMARK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/></svg>';
interface Host {
  current(): { file: TFile; container: HTMLElement } | null;
  lookup(file: TFile): Promise<Annotation | null>;
  add(file: TFile): Promise<void>;
  /** show this page's bookmark: where the reader left off, and a deliberate Remove */
  open(mark: Annotation, file: TFile): void;
  error(): void;
}

/** Hold/right-click opens the bookmark list without also executing the release click. */
export function bookmarkHold(button: HTMLElement, open: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined, held = false;
  const cancel = () => clearTimeout(timer);
  const down = (event: PointerEvent) => {
    cancel(); held = false;
    if (event.button === 0) timer = setTimeout(() => { held = true; open(); }, 450);
  };
  const click = (event: MouseEvent) => { if (held) { event.preventDefault(); event.stopImmediatePropagation(); held = false; } };
  const key = () => { held = false; };
  const context = (event: MouseEvent) => { event.preventDefault(); cancel(); if (!held) { held = true; open(); } };
  button.addEventListener('pointerdown', down);
  for (const name of ['pointerup','pointercancel','pointerleave']) button.addEventListener(name, cancel);
  button.addEventListener('click', click, true); button.addEventListener('contextmenu', context);
  button.addEventListener('keydown', key);
  return () => {
    cancel(); button.removeEventListener('pointerdown', down);
    for (const name of ['pointerup','pointercancel','pointerleave']) button.removeEventListener(name, cancel);
    button.removeEventListener('click', click, true); button.removeEventListener('contextmenu', context);
    button.removeEventListener('keydown', key);
  };
}

/** A quiet ribbon in the existing title bar and a matching dock button.
 * Empty ribbon: tap bookmarks the page. Gold ribbon: tap shows the bookmark (never deletes). */
export class BookmarkControls {
  private button: HTMLButtonElement | null = null;
  private badge: HTMLElement | null = null;
  private generation = 0;
  private disposed = false;
  private busy = false;
  private shownPath: string | null = null;
  private openList = () => {};
  private stopHold = () => {};
  constructor(private host: Host) {}

  mountButton(button: HTMLButtonElement, openList: () => void): void {
    this.unmountButton(); this.button = button; this.openList = openList;
    button.innerHTML = BOOKMARK_ICON;
    this.stopHold = bookmarkHold(button, openList);
    void this.refresh();
  }
  unmountButton(): void { this.stopHold(); this.button = null; }

  async refresh(): Promise<void> {
    if (this.disposed) return;
    const token = ++this.generation, page = this.host.current();
    if (this.shownPath !== page?.file.path) this.paint(false, page, true);
    if (!page) { this.paint(false, null); return; }
    try {
      const mark = await this.host.lookup(page.file);
      if (this.disposed || token !== this.generation || this.host.current()?.file.path !== page.file.path) return;
      this.paint(!!mark, page);
    } catch {
      if (token === this.generation && !this.disposed) this.paint(false, page);
    }
  }

  async toggle(): Promise<void> {
    if (this.busy || this.disposed) return;
    const page = this.host.current();
    if (!page) { this.openList(); return; }
    this.busy = true; if (this.button) this.button.disabled = true;
    try {
      const mark = await this.host.lookup(page.file);
      // A slow lookup must never act on the page we have since navigated away from.
      if (this.host.current()?.file.path !== page.file.path) return;
      if (mark) this.host.open(mark, page.file); else await this.host.add(page.file);
    } catch { this.host.error(); }
    finally { this.busy = false; await this.refresh(); }
  }

  private paint(marked: boolean, page: ReturnType<Host['current']>, loading = false): void {
    this.shownPath = page?.file.path ?? null;
    this.badge?.remove(); this.badge = null;
    if (marked && page) {
      const title = page.container.querySelector('.view-header-title-container');
      if (title) {
        const badge = document.createElement('span');
        badge.className = 'sg-bookmark-ribbon'; badge.innerHTML = BOOKMARK_ICON;
        badge.setAttribute('role', 'img'); badge.setAttribute('aria-label', 'Bookmarked');
        badge.title = 'Bookmarked — your place is kept as you read';
        if (getComputedStyle(title).display === 'none') {
          const header = page.container.querySelector('.view-header');
          header?.insertBefore(badge, header.querySelector('.view-actions'));
        } else title.append(badge);
        this.badge = badge;
      }
    }
    if (this.button) {
      this.button.classList.toggle('sg-bookmarked', marked);
      this.button.disabled = loading || this.busy;
      const label = page ? marked ? 'Bookmarked — see where you left off' : 'Bookmark this page' : 'Bookmarks';
      this.button.setAttribute('aria-label', label);
      this.button.title = page ? `${label} · Hold for all bookmarks` : label;
      this.button.setAttribute('aria-description', 'Hold or right-click to open all bookmarks.');
      if (page) this.button.setAttribute('aria-pressed', String(marked));
      else this.button.removeAttribute('aria-pressed');
    }
  }
  dispose(): void { this.disposed = true; ++this.generation; this.unmountButton(); this.badge?.remove(); this.badge = null; }
}
