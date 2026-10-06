import { BOOK_BY_SLUG, chapterTitle } from '@scripture-graph/core-sdk';
import { SCENE_OVERRIDES } from './presence';
import { SCENE_CATALOG } from './sceneCatalog';

export interface EventBackground {
  slug: string; chapter: string; volume: string; scene: string; name: string;
}

/** Only explicit chapter assignments, never keyword guesses or whole-book defaults. */
export function eventBackgrounds(names: Record<string, string>): EventBackground[] {
  return Object.entries(SCENE_OVERRIDES).flatMap(([slug, scene]) => {
    const match = /^(.+)-(\d+)$/.exec(slug);
    const book = match && BOOK_BY_SLUG.get(match[1]!);
    const number = Number(match?.[2]);
    if (!book || number < 1 || number > book.chapters || !SCENE_CATALOG[scene]) return [];
    return [{ slug, chapter: chapterTitle(book.slug, number)!, volume: book.volume,
      scene, name: names[scene] ?? scene, order: book.volumeSeq * 100000 + book.bookSeq * 1000 + number }];
  }).sort((a, b) => a.order - b.order);
}

export function filterBackgrounds(rows: EventBackground[], query: string): EventBackground[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => terms.every(term => `${row.chapter} ${row.volume} ${row.name}`.toLowerCase().includes(term)));
}

interface GalleryIO {
  query(value: string): void;
  page(value: number): void;
  photo(scene: string, wide: boolean): Promise<string>;
  preview(row: EventBackground): void;
  open(chapter: string): void;
}

/** Bounded pages plus viewport loading keep a review from filling a phone's cache. */
export function renderEventBackgrounds(c: HTMLElement, rows: EventBackground[], query: string, page: number, io: GalleryIO): () => void {
  const search = c.createEl('input', { cls: 'sg-nav-filter', attr: {
    type: 'search', placeholder: 'Search chapters or events…', 'aria-label': 'Search event backgrounds' } });
  search.value = query;
  c.createEl('p', { cls: 'sg-event-help', text: 'Chapters with assigned backgrounds. Tap a photo to inspect it, or open the chapter to read. Photos load as you browse.' });
  const results = c.createDiv();
  let disposePage = () => {};
  const render = () => {
    disposePage(); results.empty();
    let disposed = false;
    const matches = filterBackgrounds(rows, query);
    const pageCount = Math.max(1, Math.ceil(matches.length / 12));
    page = Math.min(Math.max(0, page), pageCount - 1); io.page(page);
    results.createEl('p', { text: `${matches.length} chapters · ${new Set(matches.map(r => r.scene)).size} backgrounds` });
    const grid = results.createDiv({ cls: 'sg-nav-covers sg-event-grid' });
    const loaders = new Map<Element, () => void>();
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { loaders.get(entry.target)?.(); observer?.unobserve(entry.target); }
    }, { rootMargin: '100px' });
    disposePage = () => { disposed = true; observer?.disconnect(); loaders.clear(); };
    for (const row of matches.slice(page * 12, (page + 1) * 12)) {
      const cell = grid.createDiv({ cls: 'sg-event-cell' });
      const cover = cell.createEl('button', { cls: 'sg-nav-cover sg-event-cover', attr: { 'aria-label': `Preview ${row.name} — ${row.chapter}` } });
      const art = cover.createDiv({ cls: 'sg-nav-cover-art' });
      const status = art.createSpan({ cls: 'sg-event-status', text: 'Photo preview' });
      cover.createDiv({ cls: 'sg-nav-cover-label', text: row.chapter });
      cell.createDiv({ cls: 'sg-event-scene-name', text: row.name });
      let loading = false;
      const load = async () => {
        if (disposed || loading) return;
        loading = true; status.setText('Loading photo…');
        try {
          const url = await io.photo(row.scene, false);
          if (disposed) return;
          const img = art.createEl('img', { attr: { src: url, alt: row.name } });
          img.onerror = () => { img.remove(); loading = false; status.setText('Photo unavailable · tap to retry'); };
          status.setText('');
        } catch { if (!disposed) { loading = false; status.setText('Photo unavailable · tap to retry'); } }
      };
      loaders.set(cover, () => void load());
      if (observer) observer.observe(cover); else void load();
      cover.onclick = () => { io.preview(row); if (!loading) void load(); };
      cell.createEl('button', { cls: 'sg-event-open', text: 'Open chapter' }).onclick = () => io.open(row.chapter);
    }
    if (!matches.length) results.createEl('p', { text: 'No assigned backgrounds match your search.' });
    if (pageCount > 1) {
      const nav = results.createDiv({ cls: 'sg-event-pagination' });
      const previous = nav.createEl('button', { text: 'Previous' }); previous.disabled = page === 0;
      nav.createSpan({ text: `${page + 1} / ${pageCount}`, attr: { 'aria-live': 'polite' } });
      const next = nav.createEl('button', { text: 'Next' }); next.disabled = page + 1 === pageCount;
      const turn = (delta: number) => { page += delta; render(); c.scrollIntoView({ block: 'start' }); };
      previous.onclick = () => turn(-1); next.onclick = () => turn(1);
    }
  };
  search.oninput = () => { query = search.value; page = 0; io.query(query); render(); };
  render();
  return () => disposePage();
}
