import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BOOKS } from '@scripture-graph/core-sdk';
import { CHAPTER_PHOTOS } from '../../plugins/scripture-graph/src/study/photoAssignments.generated';
import { photoLibrary, filterPhotos } from '../../plugins/scripture-graph/src/study/photoGallery';
import { matchScene, SCENE_OVERRIDES } from '../../plugins/scripture-graph/src/study/presence';
import { PHOTO_CONNECTIONS } from '../../plugins/scripture-graph/src/study/photoConnections';
import { canUseForScripture, isScripturePhoto, PERSONAL_PHOTOS, sceneForScripture } from '../../plugins/scripture-graph/src/study/photoPolicy';

const plugin = new URL('../../plugins/scripture-graph/', import.meta.url);
const source = readFileSync(new URL('src/study/scenes.ts', plugin), 'utf8');
const scenes = [...source.matchAll(/\{ id: ["']([^"']+)["'], name: ["']([^"']+)["']/g)].map(m => ({ id: m[1]!, name: m[2]! }));
const rows = photoLibrary(scenes);

it('covers the complete canon and every photo with valid, unique links that agree with the reader', () => {
  const slugs = BOOKS.flatMap(b => Array.from({ length: b.chapters }, (_, i) => `${b.slug}-${i + 1}`));
  expect(Object.keys(CHAPTER_PHOTOS)).toEqual(slugs);
  expect(rows).toHaveLength(95);
  for (const row of rows) {
    if (isScripturePhoto(row.id)) expect(row.chapters.length, row.id).toBeGreaterThan(0);
    else expect(row.chapters, row.id).toHaveLength(0);
    expect(new Set(row.chapters.map(c => c.slug)).size).toBe(row.chapters.length);
    expect(row.chapters.every(ch => slugs.includes(ch.slug))).toBe(true);
  }
  for (const slug of slugs) {
    const related = CHAPTER_PHOTOS[slug]!;
    expect(related.length).toBeGreaterThan(0);
    expect(new Set(related).size).toBe(related.length);
    expect(related.every(id => scenes.some(s => s.id === id))).toBe(true);
    expect(related.every(id => canUseForScripture(id, slug))).toBe(true);
    expect(matchScene('unrelated sync metadata battle city', slug)).toBe(related[0]);
    expect(rows.flatMap(row => row.chapters.filter(ch => ch.slug === slug && ch.primary))).toHaveLength(1);
  }
  for (const [slug, id] of Object.entries(SCENE_OVERRIDES).filter(([key]) => /-\d+$/.test(key))) expect(matchScene('', slug)).toBe(id);
});

it('keeps event identities distinct and newer scenes attached to the right passages', () => {
  for (const [slug, id] of Object.entries({
    'john-2': 'cana-feast', 'john-5': 'bethesda-pool', 'john-9': 'siloam-steps',
    'luke-24': 'emmaus-road', 'dc-121': 'liberty-window', 'morm-6': 'cumorah-morning',
    '3ne-8': 'three-days-darkness', '3ne-11': 'nephites', 'alma-14': 'prison-deliverance',
  })) expect(matchScene('', slug)).toBe(id);
  expect(CHAPTER_PHOTOS['mosiah-11']).not.toContain('ark'); // King Noah is not the Flood.
  expect(CHAPTER_PHOTOS['1sam-3']).not.toContain('samuel-wall');
  expect(CHAPTER_PHOTOS['gen-2']).not.toContain('tree-of-life');
  for (const [id, rule] of Object.entries(PHOTO_CONNECTIONS)) for (const slug of rule.chapters) expect(CHAPTER_PHOTOS[slug], `${id}: ${slug}`).toContain(id);
});

it('limits domination without forcing a photo into an unrelated event', () => {
  const counts = rows.map(row => row.chapters.filter(ch => ch.primary).length);
  expect(Math.max(...counts) / Object.keys(CHAPTER_PHOTOS).length).toBeLessThan(.12);
  for (const row of rows.filter(r => !isScripturePhoto(r.id))) expect(row.chapters).toHaveLength(0);
  // These alternatives share chapters with more specific, preserved events.
  expect(CHAPTER_PHOTOS['1ne-17']![0]).toBe('nephi-ship');
  expect(CHAPTER_PHOTOS['1ne-17']).toContain('bountiful-coast');
  expect(CHAPTER_PHOTOS['1ne-16']![0]).toBe('liahona');
  expect(CHAPTER_PHOTOS['1ne-16']).toContain('nahom-canyon');
});

it('excludes all audited personal scenes and unreviewed photos from scripture, including stale data', () => {
  expect(matchScene('', 'gen-5')).toBe('creation');
  expect(filterPhotos(rows)).toHaveLength(90);
  expect(filterPhotos(rows, '', '', 'personal').map(r => r.id).sort()).toEqual(Object.keys(PERSONAL_PHOTOS).sort());
  expect(filterPhotos(rows, 'rain')).toHaveLength(0);
  expect(filterPhotos(rows, 'rain', '', 'personal').map(r => r.id)).toEqual(['rain-study']);
  for (const id of Object.keys(PERSONAL_PHOTOS)) {
    expect(Object.values(CHAPTER_PHOTOS).some(ids => ids.includes(id)), id).toBe(false);
    expect(sceneForScripture(id, 'gen-5')).toBe('creation');
    expect(sceneForScripture(id, 'enoch-1')).toBe('waters');
  }
  expect(isScripturePhoto('unreviewed-new-photo')).toBe(false);
  expect(canUseForScripture('liberty-window', 'gen-5')).toBe(false);
  expect(canUseForScripture('liberty-window', 'dc-121')).toBe(true);
  expect(canUseForScripture('first-vision', 'gen-5')).toBe(false);
  const original = CHAPTER_PHOTOS['gen-5']!;
  try {
    CHAPTER_PHOTOS['gen-5'] = ['rain-study', 'city', 'creation'];
    expect(matchScene('', 'gen-5')).toBe('creation');
    expect(sceneForScripture('study', 'gen-5')).toBe('creation');
  } finally { CHAPTER_PHOTOS['gen-5'] = original; }
  expect(matchScene('# Lesson preparation\nStudy and teaching plan.')).toBe('study');
});

it('searches exact chapter numbers, collections, and photo names', () => {
  const matches = filterPhotos(rows, 'john 2');
  expect(matches.map(r => r.id)).toContain('cana-feast');
  expect(matches.every(r => r.chapters.some(c => c.slug === 'john-2'))).toBe(true);
  expect(filterPhotos(rows, 'John 999')).toHaveLength(0);
  expect(filterPhotos(rows, 'John 2', 'Book of Mormon')).toHaveLength(0);
  expect(filterPhotos(rows, 'Cana')).toHaveLength(1);
  expect(filterPhotos(rows, '', 'Book of Mormon').every(r => r.chapters.some(c => c.volume === 'Book of Mormon'))).toBe(true);
});

it('uses a distinct offline photo for every scene, with no shared substitute thumbnails', () => {
  const folder = new URL('src/assets/photo-thumbnails/', plugin);
  const files = readdirSync(folder).filter(f => f.endsWith('.jpg'));
  expect(files.map(f => f.slice(0, -4)).sort()).toEqual(scenes.map(s => s.id).sort());
  const hashes = files.map(file => createHash('sha256').update(readFileSync(new URL(file, folder))).digest('hex'));
  expect(new Set(hashes).size).toBe(scenes.length);
});
