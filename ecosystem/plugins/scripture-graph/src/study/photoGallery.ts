import { BOOKS, chapterTitle } from '@scripture-graph/core-sdk';
import { CHAPTER_PHOTOS } from './photoAssignments.generated';
import { connectionReason } from './photoConnections';

export interface PhotoChapter { slug: string; title: string; volume: string; primary: boolean; }
export interface LibraryPhoto { id: string; name: string; chapters: PhotoChapter[]; }
export interface PhotoGalleryState { query?: string; volume?: string; page?: number; }
export interface PhotoGalleryIO {
  thumbnail(id: string): string | undefined;
  select(id: string): void;
  preview(photo: LibraryPhoto): void;
  open(title: string): void;
}

function chapterQuery(query: string): string | null {
  const match = /^(.+?)\s+(\d+)$/.exec(query.toLowerCase().trim());
  if (!match) return null;
  const book = BOOKS.find(b => [b.name, b.prefix, b.slug, ...b.aliases].some(a => a.toLowerCase() === match[1]));
  return book ? `${book.slug}-${Number(match[2])}` : null;
}

export function photoLibrary(names: { id: string; name: string }[]): LibraryPhoto[] {
  const rows = new Map(names.map(row => [row.id, { ...row, chapters: [] as PhotoChapter[] }]));
  for (const book of BOOKS) for (let n = 1; n <= book.chapters; n++) {
    const slug = `${book.slug}-${n}`;
    for (const [i, id] of (CHAPTER_PHOTOS[slug] ?? []).entries()) rows.get(id)?.chapters.push({
      slug, title: chapterTitle(book.slug, n)!, volume: book.volume, primary: i === 0,
    });
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterPhotos(rows: LibraryPhoto[], query = '', volume = ''): LibraryPhoto[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const exact = chapterQuery(query);
  return rows.filter(row => {
    const chapters = row.chapters.filter(c => !volume || c.volume === volume);
    if (exact) return chapters.some(ch => ch.slug === exact);
    return (!volume || chapters.length > 0) && terms.every(term =>
      `${row.name} ${chapters.map(c => `${c.title} ${c.volume}`).join(' ')}`.toLowerCase().includes(term));
  });
}

function filters(c: HTMLElement, state: PhotoGalleryState, placeholder: string, change: () => void) {
  const controls = c.createDiv({ cls: 'sg-photo-filters' });
  const search = controls.createEl('input', { attr: { type: 'search', placeholder, 'aria-label': placeholder } });
  search.value = state.query ?? '';
  const volumes = controls.createEl('select', { attr: { 'aria-label': 'Scripture collection' } });
  volumes.createEl('option', { text: 'All scriptures', attr: { value: '' } });
  for (const volume of new Set(BOOKS.map(b => b.volume))) volumes.createEl('option', { text: volume, attr: { value: volume } });
  volumes.value = state.volume ?? '';
  search.oninput = () => { state.query = search.value; state.page = 0; change(); };
  volumes.onchange = () => { state.volume = volumes.value; state.page = 0; change(); };
}

function paginate(c: HTMLElement, state: PhotoGalleryState, count: number, size: number, render: () => void, top: HTMLElement) {
  const pages = Math.max(1, Math.ceil(count / size));
  if (pages === 1) return;
  const nav = c.createDiv({ cls: 'sg-photo-pagination' });
  const previous = nav.createEl('button', { text: 'Previous' }); previous.disabled = !state.page;
  nav.createSpan({ text: `${(state.page ?? 0) + 1} of ${pages}`, attr: { 'aria-live': 'polite' } });
  const next = nav.createEl('button', { text: 'Next' }); next.disabled = (state.page ?? 0) + 1 >= pages;
  const turn = (delta: number) => { state.page = (state.page ?? 0) + delta; render(); top.scrollIntoView({ block: 'start' }); };
  previous.onclick = () => turn(-1); next.onclick = () => turn(1);
}

export function renderPhotoGallery(c: HTMLElement, rows: LibraryPhoto[], state: PhotoGalleryState, io: PhotoGalleryIO): void {
  c.addClass('sg-photo-library');
  const chapters = new Set(rows.flatMap(row => row.chapters.map(ch => ch.slug))).size;
  c.createEl('p', { cls: 'sg-photo-intro', text: `${rows.length} reading photos · ${chapters.toLocaleString()} chapters. Explore a photo to see its scripture connections.` });
  filters(c, state, 'Search photos or chapters…', () => render());
  const results = c.createDiv();
  const render = () => {
    results.empty();
    const matches = filterPhotos(rows, state.query, state.volume);
    state.page = Math.min(Math.max(0, state.page ?? 0), Math.max(0, Math.ceil(matches.length / 12) - 1));
    results.createEl('p', { cls: 'sg-photo-count', text: `${matches.length} photos`, attr: { 'aria-live': 'polite' } });
    const grid = results.createDiv({ cls: 'sg-photo-grid' });
    for (const row of matches.slice(state.page * 12, (state.page + 1) * 12)) {
      const card = grid.createEl('button', { cls: 'sg-photo-card', attr: { 'aria-label': `${row.name}, ${row.chapters.length} connected chapters` } });
      const src = io.thumbnail(row.id);
      if (src) card.createEl('img', { attr: { src, alt: row.name, loading: 'lazy', decoding: 'async', width: '320', height: '400' } });
      card.createSpan({ cls: 'sg-photo-name', text: row.name });
      card.createSpan({ cls: 'sg-photo-meta', text: `${row.chapters.length} connected chapter${row.chapters.length === 1 ? '' : 's'}` });
      const shown = row.chapters.filter(ch => (!state.volume || ch.volume === state.volume));
      card.createSpan({ cls: 'sg-photo-refs', text: shown.slice(0, 2).map(ch => ch.title).join(' · ') + (shown.length > 2 ? '…' : '') });
      card.onclick = () => io.select(row.id);
    }
    if (!matches.length) results.createEl('p', { text: 'No photos match. Try another chapter, photo name, or scripture collection.' });
    paginate(results, state, matches.length, 12, render, c);
  };
  render();
  const about = c.createEl('details', { cls: 'sg-photo-about' });
  about.createEl('summary', { text: 'How photos connect to scripture' });
  about.createEl('p', { text: 'Named events and locations have explicit chapter links. General landscapes connect through themes in the scripture text. Modern study rooms are reading atmospheres. These are artistic backgrounds, including AI-created imagery; they are not historical photographs or evidence of a geographic identification.' });
  about.createEl('p', { text: 'In Match chapter mode, each chapter has a stable default. Among similarly relevant settings, the matcher favors less-used photos and avoids adjacent repeats. Every photo has chapter connections; some are alternatives where a more specific event remains the default. Several scenes may fit one chapter.' });
}

export function renderPhotoDetail(c: HTMLElement, row: LibraryPhoto, state: PhotoGalleryState, io: PhotoGalleryIO): void {
  c.addClass('sg-photo-library');
  const hero = c.createEl('button', { cls: 'sg-photo-hero', attr: { 'aria-label': `Open full photo: ${row.name}` } });
  const src = io.thumbnail(row.id);
  if (src) hero.createEl('img', { attr: { src, alt: row.name } });
  hero.createSpan({ text: 'Open full photo ↗' });
  hero.onclick = () => io.preview(row);
  const defaults = row.chapters.filter(ch => ch.primary).length;
  c.createEl('p', { cls: 'sg-photo-intro', text: `${row.chapters.length} connected chapter${row.chapters.length === 1 ? '' : 's'} · Default in ${defaults}` });
  c.createEl('p', { cls: 'sg-photo-note', text: 'Artistic reading background. “Default” is what Match chapter mode shows. Other links are related passages or thematic alternatives.' });
  filters(c, state, 'Find a connected chapter…', () => render());
  const list = c.createDiv();
  const render = () => {
    list.empty();
    const terms = (state.query ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const exact = chapterQuery(state.query ?? '');
    const matches = row.chapters.filter(ch => (!state.volume || state.volume === ch.volume)
      && (exact ? ch.slug === exact : terms.every(term => `${ch.title} ${ch.volume}`.toLowerCase().includes(term))));
    state.page = Math.min(Math.max(0, state.page ?? 0), Math.max(0, Math.ceil(matches.length / 24) - 1));
    list.createEl('p', { cls: 'sg-photo-count', text: `${matches.length} connected chapter${matches.length === 1 ? '' : 's'}`, attr: { 'aria-live': 'polite' } });
    for (const ch of matches.slice(state.page * 24, (state.page + 1) * 24)) {
      const item = list.createDiv({ cls: 'sg-photo-chapter' });
      const link = item.createEl('button', { cls: 'sg-photo-chapter-link', text: ch.title });
      if (ch.primary) item.createSpan({ cls: 'sg-photo-default', text: 'Default' });
      link.onclick = () => io.open(ch.title);
      item.createEl('p', { text: connectionReason(row.id, ch.slug) });
    }
    if (!matches.length) list.createEl('p', { text: 'No connected chapters match these filters.' });
    paginate(list, state, matches.length, 24, render, list);
  };
  render();
}
