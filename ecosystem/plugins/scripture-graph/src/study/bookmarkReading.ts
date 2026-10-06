import { MarkdownView, TFile, type ItemView } from 'obsidian';
import { CANONICAL_PREFIX, type SGState } from '../state';
import type { StudyService } from './study';
import { trackBookmarkPosition, type BookmarkPageView } from './bookmarkPosition';
import type { Position } from './readingPosition';

/** Native Markdown chapters and custom document pages share the same resume policy. */
export class BookmarkReading {
  private views = new Map<ItemView, ReturnType<typeof trackBookmarkPosition>>();
  constructor(private s: SGState, private study: StudyService) {}

  attach(view: ItemView): void {
    if (this.views.has(view)) { this.views.get(view)!.check(); return; }
    const type = view.getViewType();
    if (!(view instanceof MarkdownView) && !['scripture-graph-doc', 'scripture-graph-reader'].includes(type)) return;
    const file = () => {
      const state = view.getState() as { file?: string; path?: string; chapter?: string };
      const path = state.file ?? state.path;
      const f = path ? this.s.app.vault.getAbstractFileByPath(path)
        : state.chapter ? this.s.app.metadataCache.getFirstLinkpathDest(state.chapter, CANONICAL_PREFIX) : null;
      return f instanceof TFile ? f : null;
    };
    const tracker = trackBookmarkPosition(view as unknown as BookmarkPageView, {
      page: () => file()?.path ?? null,
      // Reading and editing scroll different elements, and a chapter read on its
      // My Notes companion is usually the editor — keep the place on both.
      root: () => view instanceof MarkdownView
        ? view.containerEl.querySelector<HTMLElement>(view.getMode() === 'preview' ? '.markdown-preview-view' : '.cm-scroller')
        : view.contentEl,
      bookmark: async path => {
        const f = this.s.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFile)) return null;
        const mark = await this.study.bookmarkOf(f);
        if (!mark || mark.author_user_id !== this.s.device.userId) return null;
        return `bookmark-position:${this.s.device.userId}:${mark.annotation_id}`;
      },
      // This device's place or the one synced from another device, whichever is newer.
      read: async key => {
        const raw = await this.s.store.get<Record<string, unknown>>(key);
        const local = raw && typeof raw['top'] === 'number' ? { place: raw as unknown as Position, at: typeof raw['savedAt'] === 'string' ? raw['savedAt'] : '' } : null;
        const synced = await this.study.syncedPlace(key.slice(key.lastIndexOf(':') + 1));
        return (synced && (!local || synced.at > local.at) ? synced.place : local?.place) ?? null;
      },
      write: (key, position) => this.s.store.put(key, { ...position, savedAt: new Date().toISOString() }),
      persist: (key, position) => {
        const f = file();
        if (f) void this.study.persistPlace(key.slice(key.lastIndexOf(':') + 1), f, position).catch(() => {});
      },
    });
    this.views.set(view, tracker);
  }
  scan(): void {
    const live = new Set<ItemView>();
    this.s.app.workspace.iterateAllLeaves(leaf => { live.add(leaf.view as ItemView); this.attach(leaf.view as ItemView); });
    for (const [view, tracker] of this.views) if (!live.has(view)) { tracker.dispose(); this.views.delete(view); }
  }
  async refresh(): Promise<void> { await Promise.all([...this.views.values()].map(tracker => tracker.refresh())); }
  flush(): void { for (const tracker of this.views.values()) tracker.flush(); }
  dispose(): void { for (const tracker of this.views.values()) tracker.dispose(); this.views.clear(); }
}
