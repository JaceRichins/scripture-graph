import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function methods(path, names) {
  const raw = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(path, raw, ts.ScriptTarget.ES2022, true);
  return ast.statements.filter(ts.isClassDeclaration).flatMap(c => [...c.members])
    .filter(m => ts.isMethodDeclaration(m) && names.includes(m.name.getText(ast))).map(m => m.getText(ast)).join('\n');
}
class TFile { constructor(path) { this.path = path; } }
const docSource = fs.readFileSync(new URL('../src/reader/docView.ts', import.meta.url), 'utf8');
const docAst = ts.createSourceFile('docView.ts', docSource, ts.ScriptTarget.ES2022, true);
const docCode = docAst.statements.filter(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => d.name.getText(docAst) === 'DOC_KINDS') || ts.isFunctionDeclaration(s) && s.name?.text === 'docKindFor').map(s => s.getText(docAst)).join('\n');
const docContext = vm.createContext({ LIBRARY_PREFIX: 'AI Library/', exports: {} });
vm.runInContext(ts.transpileModule(docCode, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, docContext);
const docKindFor = docContext.exports.docKindFor;
const code = ts.transpileModule(`class Test { ${methods('../src/main.ts', ['openNavigatorNote', 'navigatorHost'])} }; globalThis.Test = Test;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const page = 'AI Library/12 Family/Elva Mary Fowler (KWC8-FF1).md';
async function check({ lag = false, available = true, throws = false, missing = false, story = false } = {}) {
  const opened = [], notices = [], ensured = [];
  const ctx = vm.createContext({ docKindFor, TFile, LIBRARY_PREFIX: 'AI Library/', CANONICAL_PREFIX: 'AI Library/01 Scriptures/Canonical/', ANNOTATED_PREFIX: 'AI Library/01 Scriptures/Annotated/', Notice: class { constructor(t) { notices.push(t); } } });
  vm.runInContext(code, ctx);
  const target = story ? 'AI Library/12 Family/Stories/A family story.md' : page;
  const plugin = new ctx.Test(), file = new TFile(target);
  plugin.ensureLocal = async l => { ensured.push(l); if (throws) throw Error('offline'); return available; };
  plugin.vaultSync = { pathFor: () => target };
  plugin.app = { metadataCache: { getFirstLinkpathDest: () => lag || missing ? null : file }, vault: { getAbstractFileByPath: () => missing ? null : file }, workspace: { openLinkText: () => { throw Error('Family navigation must not bounce through a Markdown tab'); } } };
  plugin.openLibrarySheet = (f, fragment) => opened.push([f.path, fragment]);
  plugin.openDoc = async f => opened.push([f.path, 'reader']);
  const success = await plugin.openNavigatorNote(target + '#Biography');
  assert.equal(ensured.length, 1);
  if (!available || throws || missing) { assert.equal(success, false); assert.equal(opened.length, 0); assert.equal(notices.length, 1); }
  else { assert.equal(success, true); assert.deepEqual(opened, [[target, story ? 'reader' : 'Biography']]); assert.equal(notices.length, 0); }
  // All family surfaces use this host callback, not the old original opener.
  let hostLink;
  plugin.openNavigatorNote = async l => { hostLink = l; };
  plugin.navigatorHost().openNote(page);
  assert.equal(hostLink, page);
}
await check(); await check({ lag: true }); await check({ available: false }); await check({ throws: true }); await check({ missing: true });
await check({ story: true }); await check({ story: true, lag: true });

class Element {
  children = []; isConnected = true;
  createEl(tag, opts = {}) { const child = new Element(); Object.assign(child, { tag, ...opts }); this.children.push(child); return child; }
  createDiv(opts) { return this.createEl('div', opts); }
  createSpan(opts) { return this.createEl('span', opts); }
  remove() { this.isConnected = false; }
  setText(text) { this.text = text; }
}
const viewCtx = vm.createContext({ Date, monthDay: () => ({ m: new Date().getMonth() + 1, d: new Date().getDate() }) });
vm.runInContext(ts.transpileModule(`class View { ${methods('../src/study/libraryView.ts', ['renderFamilyWeek'])} }; globalThis.View = View;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, viewCtx);
const view = new viewCtx.View(), tapped = [], slot = new Element();
view.familyTreeData = async () => ({ people: { example: { n: 'Elva Mary Fowler', bf: '1908', page: 'Elva Mary Fowler (KWC8-FF1)' } } });
view.host = { openNote: l => tapped.push(l) };
await view.renderFamilyWeek(slot);
const rows = slot.children[0].children.filter(e => e.cls === 'sg-famweek-row');
assert.ok(rows.length);
assert.equal(rows[0].tag, 'button');
assert.equal(rows[0].attr['aria-label'], 'Open Elva Mary Fowler');
rows[0].onclick();
assert.equal(tapped[0], page);
console.log('Family navigation passed: real row tap, accessible button, exact person path, direct opener, lazy metadata lag, offline/error handling.');

vm.runInContext(ts.transpileModule(`class StoryView { ${methods('../src/study/libraryView.ts', ['renderFamilyStory'])} }; globalThis.StoryView = StoryView;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, viewCtx);
const storyView = new viewCtx.StoryView(), storySlot = new Element();
storyView.familyIndex = async () => ({});
storyView.familyTreeData = async () => null;
storyView.app = { vault: { cachedRead: async () => '```json\n' + JSON.stringify({ stories: [{ id: 'test-story', title: 'A family story', page: 'A family story', grade: 5, minutes: 8, people: [{ pid: 'test', n: 'Ancestor' }] }] }) + '\n```' } };
storyView.s = { device: {}, saveDevice: async () => {} };
storyView.host = { openNote: async () => false };
await storyView.renderFamilyStory(storySlot);
const descendants = e => e.children.flatMap(c => [c, ...descendants(c)]);
const read = descendants(storySlot).find(e => e.text === '📖 Read');
assert.ok(read);
await read.onclick();
assert.equal(storyView.s.device.storiesHeard, undefined, 'Failed opens must not mark stories as read');
let finish, calls = 0;
storyView.host.openNote = path => { calls++; assert.equal(path, 'AI Library/12 Family/Stories/A family story.md'); return new Promise(resolve => { finish = resolve; }); };
const opening = read.onclick();
assert.equal(read.disabled, true); assert.equal(read.text, 'Opening…');
await read.onclick(); assert.equal(calls, 1, 'Repeated taps must not open duplicate readers');
finish(true); await opening;
assert.equal(storyView.s.device.storiesHeard[0], 'test-story');
assert.equal(read.disabled, false);
console.log('Story Read passed: exact story path, full reader, lazy download, loading feedback, repeated taps, mark read only after success.');
