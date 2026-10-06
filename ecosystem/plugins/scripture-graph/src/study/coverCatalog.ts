/** Display-name aliases shared by local and bundled artwork. */
const COVER_ALIAS: Record<string, string> = {
  'bible-dictionary': 'dictionary', 'joseph-smith-papers': 'papers', 'general-conference': 'conference',
  'words-of-the-prophets': 'prophets', 'journals-and-writings': 'journals',
  'teachings-of-presidents': 'teachings', 'revelations-in-context': 'revelations',
  'gospel-topics': 'topics', people: 'person', places: 'place', events: 'event',
  findings: 'evidence', questions: 'question', 'church-history': 'history',
  scriptures: 'bible', 'secondary-sources': 'podcast', reference: 'languages',
  essays: 'scholarship', 'true-to-the-faith': 'doctrine', 'ai-study-guides': 'hub',
  sources: 'papers', manifests: 'papers', 'source-notes': 'papers',
  music: 'hymns',
};

export function coverKey(name: string): string {
  const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return COVER_ALIAS[slug] ?? slug;
}

export function inheritedCoverKey(path: string,
  shelves: ReadonlyArray<{ path: string; name: string; icon: string }>,
  has: (key: string) => boolean): string | undefined {
  const parts = path.split('/');
  for (let n = parts.length; n > 0; n--) {
    const here = parts.slice(0, n).join('/');
    const name = parts[n - 1]!.replace(/^\d+\s+/, '');
    const shelf = shelves.find(sec => sec.path === here);
    for (const key of [coverKey(name), shelf?.icon, shelf ? coverKey(shelf.name) : undefined]) {
      if (key && has(key)) return key;
    }
  }
  return undefined;
}

/** Pictures a shelf's tiles may wear when they have none of their own, nearest in
 * spirit first (a conference year's April and October: the Tabernacle, the choir,
 * Temple Square). The art-* paintings are the app's scene artwork. */
const RELATED: Record<string, string[]> = {
  conference: ['conference', 'music-choir', 'hymns', 'saints-volume-2', 'saints-volume-4', 'saints-volume-3'],
  'come-follow-me': ['come-follow-me', 'followhim', 'hub', 'art-creation', 'art-ark', 'art-jordan-baptism',
    'art-feeding-multitude', 'art-gethsemane', 'art-empty-tomb', 'art-bethlehem', 'art-waters-mormon',
    'art-king-benjamin', 'art-alma-angel', 'art-lehi'],
  // a shelf of named people: never another person's face — places they led from
  teachings: ['saints-volume-2', 'saints-volume-4', 'saints-volume-3', 'conference', 'music-choir', 'hymns', 'history'],
  history: ['history', 'saints-volume-1', 'restoration', 'historical-context', 'journals', 'papers'],
  papers: ['papers', 'journals', 'translation', 'book-of-commandments', 'revelations'],
  family: ['family', 'family-stories', 'family-people', 'family-tree'],
  maps: ['maps', 'geography', 'place', 'historical-context'],
  dictionary: ['dictionary', 'languages', 'names', 'hebraisms', 'bible'],
};
/** Come, Follow Me month shelves: the curriculum rotates yearly but the calendar
 * doesn't, so each month wears its season (Easter in April, liberty in July,
 * the gleaners at Thanksgiving, Bethlehem at Christmas). */
export const CFM_MONTH_ART: Record<string, string> = {
  January: 'art-creation', February: 'art-lehi', March: 'art-waters-mormon', April: 'art-empty-tomb',
  May: 'art-king-benjamin', June: 'art-jordan-baptism', July: 'art-title-liberty', August: 'followhim',
  September: 'art-feeding-multitude', October: 'hub', November: 'music-gratitude', December: 'art-bethlehem',
  Resources: 'come-follow-me',
};
export const ART_POOL = ['art-creation', 'art-ark', 'art-jordan-baptism', 'art-waters-mormon', 'art-king-benjamin',
  'art-samuel-wall', 'art-title-liberty', 'art-abinadi-testimony', 'art-gethsemane', 'art-bethlehem',
  'art-ocean-voyage', 'art-nephi-ship', 'art-empty-tomb', 'art-feeding-multitude', 'art-alma-angel', 'art-lehi',
  'art-jaredite-barges', 'art-stripling-warriors', 'art-brother-jared'];

function spread(label: string, n: number): number {
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return n ? h % n : 0;
}

/** The picture a tile shows: its own when it has one that has not been shown
 * among the last `window` tiles of this page; otherwise the first such picture
 * from its shelf's related set, then (unless `relatedOnly`, for an archive of
 * stamped years) from the scene paintings — starting at a place fixed by the
 * tile's name, so a tile keeps its picture from visit to visit. When every
 * candidate is recent (a shelf longer than the artwork), the least recently
 * shown one, so neighbours still differ. `recent` is the page so far, in order. */
export function distinctCover(own: string | undefined, shelf: string | undefined, label: string,
  recent: readonly string[], has: (key: string) => boolean,
  opts: { window?: number; relatedOnly?: boolean } = {}): string | undefined {
  const near = recent.slice(-(opts.window ?? 24));
  if (own && has(own) && !near.includes(own)) return own;
  const related = (shelf && RELATED[shelf]) ?? (own && RELATED[own]) ?? [];
  const lists = opts.relatedOnly && related.length ? [related] : [related, ART_POOL];
  const candidates: string[] = own && has(own) ? [own] : [];
  for (const list of lists) {
    const start = spread(label, list.length);
    for (let i = 0; i < list.length; i++) {
      const key = list[(start + i) % list.length]!;
      if (!has(key)) continue;
      if (!near.includes(key)) return key;
      candidates.push(key);
    }
  }
  if (!candidates.length) return shelf;
  return candidates.reduce((a, b) => recent.lastIndexOf(b) < recent.lastIndexOf(a) ? b : a);
}
