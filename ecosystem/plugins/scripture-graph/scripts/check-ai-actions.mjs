import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
// the action policy and whatever sibling modules it imports (documentTitle, assistantTeam, …)
const sdkModules = new Map();
const sdk = name => {
  if (!sdkModules.has(name)) {
    const ctx = vm.createContext({ exports: {}, require: dep => dep.startsWith('./') ? sdk(dep.slice(2)) : require(dep) });
    sdkModules.set(name, ctx);
    vm.runInContext(compile(`../../../packages/core-sdk/src/ai/${name}.ts`), ctx);
  }
  return sdkModules.get(name).exports;
};
const policy = { exports: sdk('actionPolicy') };
const prefix = 'AI Library/01 Scriptures/Canonical/';
const backgroundVisibility = vm.createContext({ exports: {}, require });
vm.runInContext(compile('../src/study/backgroundVisibility.ts'), backgroundVisibility);
class TFile { constructor(path) { this.path = path; } }
function fixture({ lag = false, available = true } = {}) {
  const files = new Map([[`${prefix}Book/John 3.md`, '**16** God so loved the world. ^john-3-16'], [`${prefix}Book/John 4.md`, '14 Living water. ^john-4-14']]);
  const notes = [], highlights = [], opened = [], ensured = [];
  const state = { settings: { themes: [] }, device: { lastColor: 'yellow', lastStyle: 'highlight' }, app: {
    metadataCache: { getFirstLinkpathDest: () => new TFile('Library/John 3.md') },
    vault: { getFiles: () => lag ? [] : [...files.keys()].map(p => new TFile(p)), adapter: {
      exists: async p => files.has(p) || [...files.keys()].some(f => f.startsWith(p + '/')),
      read: async p => { assert.ok(files.has(p)); return files.get(p); },
      list: async p => ({ files: [...files.keys()].filter(f => f.slice(0, f.lastIndexOf('/')) === p), folders: p === prefix.slice(0, -1) ? [prefix + 'Book'] : [] }),
    } },
  } };
  const host = { ensure: async p => { ensured.push(p); return available; }, openNote: async p => opened.push(p), openChapter: async p => opened.push(p) };
  const ann = { addNote: async (...args) => notes.push(args), addHighlight: async (...args) => highlights.push(args) };
  const ctx = vm.createContext({ exports: {}, require: name => {
    if (name === 'obsidian') return { TFile, Notice: class {} };
    if (name === '../state') return { CANONICAL_PREFIX: prefix };
    if (name === '@scripture-graph/core-sdk') return policy.exports;
    if (name === '../study/backgroundVisibility') return backgroundVisibility.exports;
    if (name === './lessonFiles' || name === './documentEdit') return {};
    throw Error(name);
  } });
  vm.runInContext(compile('../src/ai/actions.ts'), ctx);
  return { notes, highlights, opened, ensured, files, run: actions => ctx.exports.perform(state, ann, host, actions) };
}
for (const lag of [false, true]) {
  const f = fixture({ lag });
  await f.run([{ do: 'note', chapter: 'John 3', verse: 'john-3-16', text: 'Study this.' }, { do: 'highlight', chapter: 'John 3', verse: 'john-3-16' }, { do: 'connect', from: { chapter: 'John 3', verse: 'john-3-16' }, to: { chapter: 'John 4', verse: 'john-4-14' } }, { do: 'open', page: 'John 3', verse: 'john-3-16' }]);
  assert.equal(f.notes.length, 3); assert.equal(f.highlights.length, 1); assert.equal(f.opened.length, 1);
  assert.equal(f.notes[0][2], 'God so loved the world.'); assert.equal(f.notes[2][2], 'Living water.');
  for (const note of f.notes) { assert.equal(note[3], 'private'); assert.equal(note[4], null); }
  assert.equal(f.highlights[0][4], 'private');
}
for (const available of [true, false]) {
  const f = fixture({ available });
  const done = await f.run([{ do: 'note', chapter: 'John 3', verse: 'john-3-160', text: 'No phantom.' }, { do: 'highlight', chapter: 'John 3', verse: 'john-3-160' }, { do: 'connect', from: { chapter: 'John 3', verse: 'john-3-16' }, to: { chapter: 'John 4', verse: 'john-4-999' } }, { do: 'open', page: 'John 3', verse: 'john-3-160' }]);
  assert.equal(done.length, 4); assert.ok(done.every(x => x.startsWith("Couldn't")));
  assert.equal(f.notes.length + f.highlights.length + f.opened.length, 0);
}
{
  const f = fixture({ lag: true }); f.files.clear();
  await f.run([{ do: 'note', chapter: 'John 3', verse: 'john-3-16', text: 'Must not use a personal namesake.' }]);
  assert.equal(f.notes.length, 0, 'a personal same-title note is never canonical scripture');
}
{
  const f = fixture();
  f.files.set(`${prefix}Other/John 3.md`, '16 Duplicate. ^john-3-16');
  await f.run([{ do: 'highlight', chapter: 'John 3', verse: 'john-3-16' }]);
  assert.equal(f.highlights.length, 0, 'ambiguous canonical titles must not pick arbitrarily');
}
{
  const f = fixture(); await f.run([{ do: 'open', page: 'John 3' }, { do: 'connect', from: { chapter: 'Prayer' }, to: { chapter: 'Faith' } }]);
  assert.equal(f.opened.length, 1); assert.equal(f.notes.length, 2);
  await assert.rejects(f.run([{ do: 'open', page: '../secret' }]));
}
console.log('AI action checks passed: exact canonical anchors, lazy metadata fallback, private annotations, both connection endpoints validated, safe opens.');
