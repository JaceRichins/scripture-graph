import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/sync/vaultSync.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = vm.createContext({ exports: {}, window: { setTimeout }, require(name) {
  if (name === 'obsidian') return { Notice: class {}, TFile: class {}, Platform: { isMobile: true }, normalizePath: p => p };
  if (name === '../study/trace') return { trace() {} };
  if (name === '../social/identity') return { refreshIdentity: async () => {} };
  if (name === './sharedCache') return { sharedCache: store => store };
  throw Error(name);
} });
vm.runInContext(code, context);
const { VaultSync, SECTIONS } = context.exports;
const scripture = 'AI Library/01 Scriptures/Canonical/1 Nephi 1.md';
const talk = 'AI Library/10 General Conference/2026/Talk.md';
const other = 'AI Library/10 General Conference/2026/Other.md';
const pdf = 'AI Library/12 Family/_media/record.pdf';
const rows = [scripture, talk, other, pdf].map(p => ({ p, h: 'h1', text: 'fixture' }));
const disk = new Map(), data = new Map(), batches = [];
let version = 'v1';
const s = { device: { deviceToken: 'fixture', sync: { enabled: true } }, async saveDevice() {},
  store: { async get(k) { return structuredClone(data.get(k) ?? null); }, async put(k, v) { data.set(k, structuredClone(v)); } },
  app: { vault: { getAbstractFileByPath: p => disk.has(p) ? { path: p } : null, adapter: {
    async exists(p) { return disk.has(p); }, async mkdir(p) { disk.set(p, null); },
    async write(p, t) { disk.set(p, t); }, async remove(p) { disk.delete(p); },
  } } },
  api: { async vaultVersion() { return { version }; }, async vaultManifest() { return { version, files: rows }; },
    async vaultBatch(paths) { batches.push([...paths]); return { files: paths.map(p => rows.find(f => f.p === p)) }; } },
};
const sync = new VaultSync(s, () => 'phone');
disk.set('.scripture-engine/config/config.yaml', 'copied marker');
assert.equal(await sync.isSource(), false, 'A copied engine marker must not stop phone sync');
for (const p of ['AI Library/12 Family/Family Tree.md', 'AI Library/12 Family/Family Stories.md']) {
  assert.equal(sync.wanted(p, { pins: [], sections: { family: false } }), true, 'Small family indexes remain available with lazy family pages');
}
sync.pushPersonal = sync.pullPersonal = async () => {};
await sync.refreshCatalog();
assert.equal(batches.length, 0, 'catalog discovery downloads no documents');
assert.equal(sync.remoteUnder('AI Library/10 General Conference').folders[0].name, '2026');
assert.equal(sync.pathFor('Talk'), talk);
await sync.run('manual');
assert.deepEqual(batches.flat(), [scripture], 'default sync only fetches the offline core');
assert.equal(disk.has(pdf), false);
// An on-demand fetch and background checkpoint retain both records.
await Promise.all([sync.fetchNow(talk), sync.run('manual')]);
assert.ok(data.get('vaultsync:index')[talk]);
assert.ok(data.get('vaultsync:index')[scripture]);
assert.ok(s.device.sync.pins.includes(talk));
assert.equal(disk.has(other), false); assert.equal(disk.has(pdf), false);
version = 'v2'; rows[1].h = 'h2'; rows[1].text = 'updated talk';
await sync.run('live');
assert.equal(disk.get(talk), 'updated talk', 'opened pages receive server updates automatically');
assert.equal(disk.has(other), false); assert.equal(disk.has(pdf), false);
// Undo the exact all-on preset produced by the retired button on startup.
s.device.sync.sections = Object.fromEntries(SECTIONS.map(section => [section.key, true]));
await sync.run('startup');
assert.equal(s.device.sync.sections.family, undefined);
assert.equal(disk.has(pdf), false);
assert.equal(disk.get(talk), 'updated talk', 'opened/pinned pages survive the correction');
console.log('Lazy library checks passed: catalog without downloads, core-only sync, page on demand, concurrent cache merge, automatic page updates and retired full-preset recovery.');
