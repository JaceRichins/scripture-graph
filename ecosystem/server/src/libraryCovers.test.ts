import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const PLUGIN = new URL('../../plugins/scripture-graph/', import.meta.url);
const COVERS = new URL('src/assets/library-covers/', PLUGIN);
const VAULT = new URL('../../../Scripture%20Graph/AI%20Library/', PLUGIN);

function catalog() {
  const src = readFileSync(new URL('src/study/coverCatalog.ts', PLUGIN), 'utf8');
  const exports: Record<string, any> = {};
  vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports });
  return exports as { coverKey(n: string): string; distinctCover(own: string | undefined, shelf: string | undefined, label: string, recent: string[], has: (k: string) => boolean, opts?: { window?: number; relatedOnly?: boolean }): string | undefined; ART_POOL: string[] };
}
const keys = new Set(readdirSync(COVERS).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)));
const has = (k: string) => keys.has(k);

/** draw one page's tiles the way libraryView.cover does */
function page(tiles: { own?: string; label: string }[], shelf?: string, relatedOnly = false): string[] {
  const { distinctCover } = catalog();
  const shown: string[] = [];
  return tiles.map(t => {
    const k = distinctCover(t.own, shelf, t.label, shown, has, { window: WINDOW, relatedOnly })!;
    shown.push(k);
    return k;
  });
}
const WINDOW = 24;   // libraryView COVER_WINDOW
/** repeats within any WINDOW neighbouring tiles (a page of ≤ WINDOW tiles: any repeat at all) */
const repeats = (ks: string[]) => ks.filter((k, i) => ks.slice(Math.max(0, i - WINDOW), i).includes(k));
const noRepeats = (ks: string[]) => expect(repeats(ks)).toEqual([]);

describe('library cover art', () => {
  it('ships no picture twice under different names', () => {
    const byHash = new Map<string, string[]>();
    for (const k of keys) {
      const h = createHash('md5').update(readFileSync(new URL(`${k}.jpg`, COVERS))).digest('hex');
      byHash.set(h, [...(byHash.get(h) ?? []), k]);
    }
    expect([...byHash.values()].filter(v => v.length > 1)).toEqual([]);
  });

  it('gives every pool picture a real file', () => {
    for (const k of catalog().ART_POOL) expect(has(k), k).toBe(true);
  });

  it('never repeats a picture on the Come, Follow Me months (all twelve used to be the Sermon on the Mount)', () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Resources'];
    const { CFM_MONTH_ART } = catalog() as any;
    const ks = page(months.map(label => ({ own: CFM_MONTH_ART[label] ?? 'come-follow-me', label })), 'come-follow-me');
    noRepeats(ks);
    expect(ks[3]).toBe('art-empty-tomb');   // April is Easter
    expect(ks.every(has)).toBe(true);
  });

  it('never repeats on a conference year, a shelf of presidents, or the Library page', () => {
    const { coverKey } = catalog();
    noRepeats(page([{ own: coverKey('April'), label: 'April' }, { own: coverKey('October'), label: 'October' }], 'conference'));
    const presidents = ['Joseph Smith', 'Brigham Young', 'John Taylor', 'Wilford Woodruff', 'Lorenzo Snow', 'Joseph F. Smith',
      'Heber J. Grant', 'George Albert Smith', 'David O. McKay', 'Harold B. Lee', 'Spencer W. Kimball', 'Ezra Taft Benson',
      'Howard W. Hunter', 'Gordon B. Hinckley', 'Joseph Fielding Smith'];
    const drawn = page(presidents.map(label => ({ own: coverKey(label), label })), 'teachings');
    noRepeats(drawn);
    // a president without a portrait never wears someone else's face
    const faces = new Set([...presidents.map(coverKey).filter(has), 'prophets', 'person']);
    presidents.forEach((p, i) => { if (!has(coverKey(p))) expect(faces.has(drawn[i]!), `${p} -> ${drawn[i]}`).toBe(false); });
    // the Library page itself: volumes, study, reference shelves, music, in the order drawn
    noRepeats(page([
      ...['old-testament', 'new-testament', 'book-of-mormon', 'doctrine', 'pearl', 'book-of-enoch', 'book-of-commandments'].map(own => ({ own, label: own })),
      ...['come-follow-me', 'sunday-lessons', 'my-work', 'hub', 'question', 'timeline-history', 'graph', 'maps'].map(own => ({ own, label: own })),
      ...['General Conference', 'Family', 'Bible Dictionary', 'Gospel Topics', 'People', 'Places', 'Events', 'Doctrines',
        'Words of the Prophets', 'Church History', 'Findings', 'Scholarship', 'Podcasts & talks'].map(label => ({ own: coverKey(label), label })),
      ...['hymns', 'hymnbook', 'music-family'].map(own => ({ own, label: own })),
    ]));
  });

  it('keeps a stamped year archive in its own imagery, and never puts the same picture side by side', () => {
    const years = Array.from({ length: 129 }, (_, i) => String(2026 - i));
    const ks = page(years.map(label => ({ own: label, label })), 'conference', true);
    expect(new Set(ks)).toEqual(new Set(['conference', 'music-choir', 'hymns', 'saints-volume-2', 'saints-volume-4', 'saints-volume-3']));
    expect(ks.filter((k, i) => i > 0 && ks.slice(Math.max(0, i - 5), i).includes(k))).toEqual([]);
  });

  it('never repeats on any shelf of the real vault', () => {
    if (!existsSync(VAULT)) return;
    const { coverKey } = catalog();
    const walk = (dir: URL, rel: string): void => {
      const entries = readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory());
      const folders = entries.map(e => e.name).filter(n => n !== 'Full Text' && !n.startsWith('_') && !n.startsWith('.'));
      const yearish = folders.length > 3 && folders.every(n => /^\d{4}$/.test(n));
      if (folders.length && !yearish && !/^(00 System|01 Scriptures)/.test(rel)) {
        const ks = page(folders.map(n => { const label = n.replace(/^\d{2}\s+(?=\D)/, ''); return { own: coverKey(label), label }; }),
          coverKey(rel.split('/').pop()!.replace(/^\d+\s+/, '')));
        expect(repeats(ks), rel).toEqual([]);
      }
      if (rel.split('/').length < 5) for (const e of entries) if (!e.name.startsWith('_') && !e.name.startsWith('.') && e.name !== 'Full Text')
        walk(new URL(`${encodeURIComponent(e.name)}/`, dir), rel ? `${rel}/${e.name}` : e.name);
    };
    walk(VAULT, '');
  });
});
