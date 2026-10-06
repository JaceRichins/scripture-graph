import type { TreeData } from './familyTree';

export type FamilySection = 'family' | 'family-stories' | 'family-people';
export interface FamilyEntry { kind: 'story' | 'person'; title: string; subtitle: string; path: string | null; search: string; personIds?: string[] }
const ROOT = 'AI Library/12 Family/';
const normalized = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function pagePath(page: string, story: boolean): string | null {
  const path = (page.startsWith('AI Library/') ? page : ROOT + (story ? 'Stories/' : '') + page).replace(/\.md$/, '') + '.md';
  return path.startsWith(ROOT + (story ? 'Stories/' : '')) && !path.includes('\\')
    && !path.split('/').some(p => p.startsWith('.') || !p) ? path : null;
}

export function familyEntries(tree: TreeData | null, stories: any[], files: { name: string; path: string }[]): FamilyEntry[] {
  const rows = new Map<string, FamilyEntry>();
  for (const f of files) {
    const story = f.path.startsWith(ROOT + 'Stories/');
    if (!story && !/\([A-Z0-9-]+\)(?:\.md)?$/.test(f.name)) continue;
    const path = pagePath(f.path, story);
    if (!path) continue;
    const title = f.name.replace(/\.md$/, '').replace(/\s*\([a-f0-9]{12}\)$/, '');
    const personId = !story ? /\(([A-Z0-9-]+)\)(?:\.md)?$/.exec(f.name)?.[1] : undefined;
    rows.set(path, { kind: story ? 'story' : 'person', title, subtitle: '', path, search: normalized(title), personIds: personId ? [personId] : [] });
  }
  for (const s of stories) {
    if (!s || typeof s.title !== 'string' || typeof s.page !== 'string') continue;
    const path = pagePath(s.page, true); if (!path) continue;
    const people = Array.isArray(s.people) ? s.people.map((p: any) => p.n ?? '').join(' · ') : '';
    const subtitle = [people, typeof s.minutes === 'number' ? `${s.minutes} min read` : ''].filter(Boolean).join(' · ');
    rows.set(path, { kind: 'story', title: s.title, subtitle, path, personIds: Array.isArray(s.people) ? s.people.map((p: any) => p.pid).filter((p: any) => typeof p === 'string') : [],
      search: normalized([s.title, people, s.hook ?? '', ...(Array.isArray(s.themes) ? s.themes : [])].join(' ')) });
  }
  for (const [id, p] of Object.entries(tree?.people ?? {})) {
    const path = p.page ? pagePath(p.page, false) : null;
    const subtitle = [p.living ? 'Living' : [p.b, p.d].filter(Boolean).join('–'), p.bp ?? ''].filter(Boolean).join(' · ');
    rows.set(path ?? id, { kind: 'person', title: p.n, subtitle, path, personIds: [id],
      search: normalized([p.n, id, p.b, p.d, p.bf, p.df, p.bp, p.dp].filter(Boolean).join(' ')) });
  }
  return [...rows.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export function filterFamily(rows: FamilyEntry[], query: string, section: FamilySection): FamilyEntry[] {
  const tokens = normalized(query).split(' ').filter(Boolean);
  return rows.filter(r => (section === 'family' || r.kind === (section === 'family-stories' ? 'story' : 'person'))
    && tokens.every(token => r.search.includes(token)));
}

/** Only indexes and catalog metadata are loaded; choosing a row opens its
 * page through the normal on-demand route. Typing never rebuilds the input. */
export function renderFamilyLibrary(c: HTMLElement, section: FamilySection, query: string, io: {
  load(): Promise<{ rows: FamilyEntry[]; incomplete: boolean; relevant?: Set<string> }>;
  query(value: string): void;
  go(section: FamilySection | 'family-tree'): void;
  cover(grid: HTMLElement, options: { label: string; photo: string; onTap(): void }): void;
  open(path: string): Promise<unknown>;
}): void {
  if (section === 'family') {
    const links = c.createDiv({ cls: 'sg-nav-covers' });
    for (const [target, title] of [
      ['family-stories', 'Family Stories'],
      ['family-people', 'Family People'],
      ['family-tree', 'Family Tree'],
    ] as const) {
      io.cover(links, { label: title, photo: target, onTap: () => io.go(target) });
    }
  }
  const input = c.createEl('input', { cls: 'sg-nav-filter', attr: { type: 'search',
    placeholder: section === 'family-people' ? 'Search names, dates, places…' : section === 'family-stories' ? 'Search stories, people, themes…' : 'Search family stories and people…',
    'aria-label': 'Search family library' } });
  input.value = query;
  const scopes = c.createDiv({ cls: 'sg-cfm-chips' });
  const yours = scopes.createEl('button', { cls: 'sg-cfm-chip', text: 'Your family' });
  const all = scopes.createEl('button', { cls: 'sg-cfm-chip', text: 'All shared family' });
  let onlyYours = true, relevant: Set<string> | undefined;
  yours.disabled = true;
  const status = c.createDiv({ cls: 'sg-nav-progress', text: 'Loading your family library…' });
  const list = c.createDiv({ cls: 'sg-collection-list' });
  let rows: FamilyEntry[] = [], loaded = false, incomplete = false, limit = 50;
  const draw = () => {
    if (!loaded) return;
    list.empty();
    const visible = onlyYours && relevant ? rows.filter(r => r.personIds?.some(pid => relevant!.has(pid))) : rows;
    const matches = filterFamily(visible, query, section);
    status.setText(section === 'family' && !query.trim()
      ? `${visible.filter(r => r.kind === 'story').length} stories · ${visible.filter(r => r.kind === 'person').length} people`
      : `${matches.length} ${matches.length === 1 ? 'result' : 'results'}`);
    if (onlyYours && relevant?.size === 0) {
      status.setText('Your family profile is not linked yet. Choose All shared family to browse.');
    }
    if (incomplete) {
      const retry = list.createEl('button', { cls: 'sg-nav-dl', text: 'Some family records could not load — Retry' });
      retry.onclick = () => { void load(); };
    }
    if (section === 'family' && !query.trim()) return;
    for (const r of matches.slice(0, limit)) {
      const button = list.createEl('button', { cls: 'sg-collection-row' });
      const copy = button.createSpan({ cls: 'sg-collection-copy' });
      copy.createSpan({ cls: 'sg-collection-title', text: r.title });
      copy.createSpan({ cls: 'sg-collection-description', text: [section === 'family' ? (r.kind === 'story' ? 'Story' : 'Person') : '', r.subtitle,
        !r.path ? 'Family tree record; no individual page yet' : ''].filter(Boolean).join(' · ') });
      if (!r.path) button.disabled = true;
      else button.onclick = async () => {
        button.disabled = true;
        try {
          if (await io.open(r.path!) === false) throw Error('Unavailable');
        } catch { status.setText('This page could not open. Check your connection and try again.'); }
        finally { button.disabled = false; }
      };
    }
    if (matches.length > limit) {
      const more = list.createEl('button', { cls: 'sg-nav-dl', text: 'Show more' });
      more.onclick = () => { limit += 50; draw(); };
    }
    if (!matches.length) list.createDiv({ cls: 'sg-nav-empty', text: query.trim() ? 'No matching family records.' : 'No records here yet.' });
  };
  const load = async () => {
    try { const result = await io.load(); rows = result.rows; incomplete = result.incomplete; relevant = result.relevant; }
    catch { incomplete = true; }
    if (!c.isConnected) return;
    loaded = true; draw();
  };
  input.oninput = () => { query = input.value; io.query(query); limit = 50; draw(); };
  yours.onclick = () => { onlyYours = true; yours.disabled = true; all.disabled = false; limit = 50; draw(); };
  all.onclick = () => { onlyYours = false; yours.disabled = false; all.disabled = true; limit = 50; draw(); };
  void load();
}
