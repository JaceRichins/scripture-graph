// Regenerate only when canon or matching rules change. Normal builds need no vault.
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ stdin: { contents: `export { SCENE_OVERRIDES, matchPageScene } from './src/study/presence'; export * from './src/study/photoConnections';`, resolveDir: root }, bundle: true, write: false, format: 'cjs', platform: 'node' });
const context = { exports: {}, module: { exports: {} }, require: createRequire(import.meta.url) };
context.exports = context.module.exports;
vm.runInNewContext(bundle.outputFiles[0].text, context);
const { SCENE_OVERRIDES, matchPageScene, PHOTO_CONNECTIONS, SETTING_RULES } = context.module.exports;
const books = JSON.parse(readFileSync(resolve(root, '../../packages/core-sdk/src/books.json'), 'utf8'));
const sceneIds = [...readFileSync(resolve(root, 'src/study/scenes.ts'), 'utf8').matchAll(/\{ id: ["']([^"']+)["']/g)].map(m => m[1]);
const canonical = resolve(root, '../../../Scripture Graph/AI Library/01 Scriptures/Canonical');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(dir, entry.name)) : [resolve(dir, entry.name)]);
const texts = new Map();
for (const file of walk(canonical).filter(file => file.endsWith('.md'))) {
  const text = readFileSync(file, 'utf8');
  const slug = /^slug: ([\w-]+)\r?$/m.exec(text)?.[1];
  if (slug) texts.set(slug, text);
}
const candidates = new Map(), oldCounts = {}, primaryCounts = Object.fromEntries(sceneIds.map(id => [id, 0]));
for (const book of books) for (let number = 1; number <= book.chapters; number++) {
  const slug = `${book.slug}-${number}`, text = texts.get(slug);
  if (!text) throw Error(`Missing canonical chapter ${slug}`);
  const old = matchPageScene(text, slug); oldCounts[old] = (oldCounts[old] ?? 0) + 1;
  // Only the immutable verse text supplies keyword evidence, never generated
  // commentary, links, metadata, or repeated titles.
  const clean = text.split(/\r?\n/).filter(line => /^\*\*\d+\*\*/.test(line)).join('\n').replace(/\^[\w-]+/g, '');
  if (!clean) throw Error(`No scripture verses in ${slug}`);
  const scores = new Map();
  for (const rule of SETTING_RULES) {
    const hits = clean.match(rule.words) ?? [];
    if (!hits.length) continue;
    const score = Math.min(hits.length, 5) + new Set(hits.map(word => word.toLowerCase())).size * 2;
    for (const id of rule.ids) scores.set(id, Math.max(scores.get(id) ?? 0, score));
  }
  // Explicit connections remain visible even when another event is the default.
  const explicit = Object.entries(PHOTO_CONNECTIONS).filter(([, rule]) => rule.chapters.includes(slug)).map(([id]) => id);
  const locked = SCENE_OVERRIDES[slug];
  const best = Math.max(0, ...scores.values());
  const eligible = [...scores].filter(([, score]) => score >= Math.max(4, best * .70));
  for (const id of explicit) if (!eligible.some(([s]) => s === id)) eligible.push([id, best + 5]);
  if (locked && !eligible.some(([s]) => s === locked)) eligible.push([locked, best + 10]);
  if (!eligible.length) eligible.push(...['study', 'rain-study', 'winter-hearth'].map(id => [id, 1]));
  candidates.set(slug, { eligible, locked, explicit });
  if (locked) primaryCounts[locked]++;
}
const assignments = {};
let previous = '', previousBook = '';
for (const [slug, { eligible, locked, explicit }] of candidates) {
  const book = slug.replace(/-\d+$/, '');
  // A named passage takes precedence over atmosphere. Among similarly relevant
  // alternatives prefer the less-used image, with an adjacent-chapter penalty.
  const pool = explicit.length ? eligible.filter(([id]) => explicit.includes(id)) : eligible;
  const rank = ([id, score]) => score / Math.sqrt(1 + primaryCounts[id] / 6)
    * (previousBook === book && previous === id && pool.length > 1 ? .48 : 1);
  const chosen = locked ?? [...pool].sort((a, b) => rank(b) - rank(a) || a[0].localeCompare(b[0]))[0][0];
  if (!locked) primaryCounts[chosen]++;
  assignments[slug] = [chosen, ...eligible.map(([id]) => id).filter(id => id !== chosen).sort()];
  previous = chosen; previousBook = book;
}
const connected = new Set(Object.values(assignments).flat());
for (const id of sceneIds) if (!connected.has(id)) throw Error(`Unassigned photo: ${id}`);
for (const [id, rule] of Object.entries(PHOTO_CONNECTIONS)) {
  if (!sceneIds.includes(id)) throw Error(`Unknown photo ${id}`);
  for (const slug of rule.chapters) if (!assignments[slug]?.includes(id)) throw Error(`Invalid connection ${id}: ${slug}`);
}
for (const ids of Object.values(assignments)) for (const id of ids) if (!sceneIds.includes(id)) throw Error(`Unknown assignment ${id}`);
const code = '// Generated by scripts/build-photo-assignments.mjs from canonical verse text.\n// First photo is the stable default; remaining photos are related alternatives.\nexport const CHAPTER_PHOTOS: Record<string, string[]> = {\n'
  + Object.entries(assignments).map(([slug, ids]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(ids)},`).join('\n') + '\n};\n';
writeFileSync(resolve(root, 'src/study/photoAssignments.generated.ts'), code);
const report = { chapters: Object.keys(assignments).length, photos: sceneIds.length, connectedPhotos: connected.size,
  defaultPhotos: Object.values(primaryCounts).filter(n => n > 0).length,
  relatedOnly: sceneIds.filter(id => !primaryCounts[id]),
  mostUsed: Object.entries(primaryCounts).sort((a,b) => b[1]-a[1]),
  method: 'Exact passages first; relevant setting candidates within 70% of top keyword score; deterministic usage balancing and adjacent-chapter penalty. No forced unrelated assignments.' };
// Capture the previous committed matcher for a before/after audit when it has
// no generated-table dependency. Once committed, future runs omit this field.
const before = execFileSync('git', ['show', 'HEAD:ecosystem/plugins/scripture-graph/src/study/presence.ts'], {cwd:root,encoding:'utf8'});
if (!before.includes('photoAssignments.generated')) {
  const old = { exports: {} };
  vm.runInNewContext(ts.transpileModule(before, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, old);
  const counts = {};
  for (const slug of candidates.keys()) { const id = old.exports.matchScene(texts.get(slug),slug); counts[id]=(counts[id]??0)+1; }
  report.previous = { defaultPhotos: Object.keys(counts).length, unusedPhotos: sceneIds.filter(id=>!counts[id]), mostUsed: Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8) };
}
mkdirSync(resolve(root, '../../../output/photo-gallery'), { recursive: true });
writeFileSync(resolve(root, '../../../output/photo-gallery/assignment-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, mostUsed: report.mostUsed.slice(0, 12) }, null, 2));
