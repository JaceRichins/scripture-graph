import { CHAPTER_PHOTOS } from './photoAssignments.generated';

/** Visual audit, 2026-10-06. New images must be explicitly reviewed before
 * entering scripture matching. Personal rooms never become scripture art. */
export const PERSONAL_PHOTOS: Record<string, string> = {
  'rain-study': 'A modern reading nook with a table lamp, cup, and glazed window.',
  'winter-hearth': 'A furnished cottage reading room with a fireplace and glazed window.',
  study: 'A later-era study with bound books, a writing desk, and a glazed window.',
  candle: 'A later-era reading room with a bound book, chair, candle, and glazed window.',
  city: 'A later-era city view with kerosene-style lanterns and a skyline unsuitable for ancient scripture.',
};

// Explicit allowlist: an unreviewed future photo is excluded by default.
const APPROVED_SCRIPTURE_PHOTOS = new Set([
  'emmaus-road', 'bethany-courtyard', 'cana-feast', 'nazareth-workshop', 'bethesda-pool',
  'siloam-steps', 'galilee-moonrise', 'mustard-garden', 'lilies-field', 'sower-furrows',
  'jericho-palms', 'sinai-starlight', 'horeb-cave', 'tabernacle-dawn', 'ruth-harvest',
  'esther-garden', 'daniel-window', 'psalm-waterfall', 'salt-sea-dawn', 'hermon-snow',
  'bountiful-coast', 'cumorah-morning', 'nahom-canyon', 'zarahemla-river',
  'liberty-window', 'nauvoo-riverside', 'pioneer-meadow', 'autumn-sanctuary',
  'alma-angel', 'prison-deliverance', 'nephi-lehi-fire', 'night-without-darkness',
  'tree-of-life', 'liahona', 'nephi-ship', 'ocean-voyage', 'enos-prayer', 'king-benjamin',
  'abinadi-testimony', 'ammon-flocks', 'title-liberty', 'stripling-warriors', 'samuel-wall',
  'brother-jared', 'jaredite-barges', 'christ-children', 'moroni-record', 'creation', 'ark',
  'exodus', 'bethlehem', 'gethsemane', 'empty-tomb', 'lehi', 'nephites', 'three-days-darkness',
  'first-vision', 'buried-weapons', 'nephite-sacrament', 'burning-bush', 'jordan-baptism',
  'feeding-multitude', 'waters-mormon', 'vineyard', 'fishing-village', 'wilderness-path',
  'ancient-synagogue', 'shepherd-pasture', 'village-well', 'potters-workshop',
  'mountain-refuge', 'desert-oasis', 'upper-room', 'cedar-forest', 'pilgrim-road',
  'riverbank', 'shore', 'olive', 'sunrise', 'waters', 'mount', 'garden', 'fields', 'storm',
  'temple', 'warcamp', 'prison', 'desert', 'starlight', 'grove',
]);
export function isScripturePhoto(id: string): boolean { return APPROVED_SCRIPTURE_PHOTOS.has(id); }

export function canUseForScripture(id: string, slug: string): boolean {
  if (!isScripturePhoto(id)) return false;
  // Historical Restoration scenes belong to their actual passages, never to
  // ancient narratives or generic keyword matching.
  const restoration: Record<string, string[]> = {
    'liberty-window': ['dc-121', 'dc-122', 'dc-123'],
    'nauvoo-riverside': ['dc-124', 'dc-127', 'dc-128', 'dc-135'],
    'pioneer-meadow': ['dc-136'], 'first-vision': ['jsh-1'],
  };
  return !restoration[id] || restoration[id]!.includes(slug);
}

/** Neutral natural scenery when the chapter does not describe a setting.
 * These are reading backdrops, not illustrations of an inferred event. */
export const SCRIPTURE_FALLBACKS = ['waters', 'sunrise', 'starlight', 'grove', 'riverbank'] as const;

/** Final display guard, including manual selection, cached settings, and auto. */
export function sceneForScripture(requested: string, slug: string): string {
  if (canUseForScripture(requested, slug)) return requested;
  return CHAPTER_PHOTOS[slug]?.find(id => canUseForScripture(id, slug)) ?? SCRIPTURE_FALLBACKS[0];
}
