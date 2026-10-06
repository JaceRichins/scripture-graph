import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.ES2022, true);
const member = parsed.statements.filter(ts.isClassDeclaration).flatMap(c => [...c.members])
  .find(m => ts.isMethodDeclaration(m) && m.name.getText(parsed) === 'openKeyboardChapter');
assert.ok(member);
const method = member.getText(parsed);
const compiled = ts.transpileModule(`class Test { ${method} }; globalThis.Test = Test;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
class TFile {}
async function check({ notes = false, reachable = true, cacheLag = false } = {}) {
  const notices = [], opened = [], fetched = [], noteFile = new TFile(), canonical = new TFile();
  const context = vm.createContext({ TFile, Notice: class { constructor(t) { notices.push(t); } } });
  vm.runInContext(compiled, context);
  const p = new context.Test();
  p.ensureLocal = async title => { fetched.push(title); return reachable; };
  p.vaultSync = { pathFor: () => 'canonical.md' };
  p.app = { metadataCache: { getFirstLinkpathDest: title => title.endsWith(' - My Notes') ? notes ? noteFile : null : cacheLag ? null : canonical },
    vault: { getAbstractFileByPath: () => canonical }, workspace: { getLeaf: () => ({ openFile: async (file, options) => opened.push({ file, options }) }) } };
  await p.openKeyboardChapter('Exodus 1');
  if (!notes && !reachable) { assert.equal(opened.length, 0); assert.equal(notices.length, 1); return; }
  assert.equal(opened.length, 1); assert.equal(opened[0].file, notes ? noteFile : canonical);
  assert.equal(opened[0].options.state.mode, 'preview');
  assert.equal(fetched.length, notes ? 0 : 1);
}
await check({ notes: true }); await check(); await check({ cacheLag: true }); await check({ reachable: false });
console.log('Keyboard chapter checks passed: personal notes, canonical fallback, metadata lag, reading mode and offline failure.');
