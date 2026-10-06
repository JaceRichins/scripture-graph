import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const notices = [], elements = [];
class TFile {
  constructor(path) { this.path = path; this.basename = path.split('/').pop().replace(/\.md$/, ''); this.parent = { path: path.slice(0, path.lastIndexOf('/')), name: path.split('/').at(-2) }; this.stat = { mtime: 1 }; }
}
function el(options = {}) {
  const node = { text: options.text ?? '', value: '', hidden: false, style: {},
    createDiv: el, createEl: (_tag, options) => el(options), createSpan: el,
    setText(text) { this.text = text; }, empty() {}, remove() { this.removed = true; },
    blur() {}, scrollIntoView() {}, querySelectorAll: () => [], classList: { add() {}, remove() {}, contains: () => false },
  }; elements.push(node); return node;
}
const obsidian = { TFile, ItemView: class { constructor() { this.contentEl = el(); } }, Notice: class { constructor(text) { notices.push(text); } }, Platform: { isMobile: false }, MarkdownRenderer: { render: async (_app, text, node) => node.setText(text) } };
const modules = {};
function load(relative) {
  if (modules[relative]) return modules[relative];
  const context = vm.createContext({ exports: {}, console, window: { setInterval, clearInterval }, require: name => {
    if (name === 'obsidian') return obsidian;
    if (name === 'zod') return require('zod');
    if (name === '@scripture-graph/core-sdk') return { ...load('../../../packages/core-sdk/src/ai/documentTitle.ts'), ...load('../../../packages/core-sdk/src/ai/assistantTeam.ts'), ...load('../../../packages/core-sdk/src/ai/actionPolicy.ts'), navigationRequest: () => null, ApiError: class extends Error {} };
    if (name === './documentTitle') return load('../../../packages/core-sdk/src/ai/documentTitle.ts');
    if (name === './assistantTeam') return load('../../../packages/core-sdk/src/ai/assistantTeam.ts');
    if (name === '../state') return { PERSONAL_PREFIX: 'Library/' };
    if (name === './documentEdit') return load('../src/ai/documentEdit.ts');
    if (name === './documentContext') return load('../src/ai/documentContext.ts');
    if (name === './actions') return load('../src/ai/actions.ts');
    if (name === './readingContext') return load('../src/ai/readingContext.ts');
    if (name === '../study/backgroundVisibility') return { backgroundVisibility: () => 100 };
    return {};
  } });
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return modules[relative] = context.exports;
}
const { AskView } = load('../src/ai/askView.ts');
const { renameDocument } = load('../src/ai/documentEdit.ts');
const { savedDocumentTitle } = load('../../../packages/core-sdk/src/ai/documentTitle.ts');
const path = 'Library/Lessons/This week/This week.md';
const file = new TFile(path), prep = new TFile('Library/Lessons/This week/Preparation.md');
const base = '---\nownership: personal\nlesson_order: 0\n---\n\n# Sunday\n\n## Questions\nWhat will you do?\n[[D&C 13]]\n';
let text = base, sent = [], accountSwap = false;
const store = new Map();
const app = { workspace: { getActiveFile: () => null }, metadataCache: { getFileCache: f => ({ frontmatter: { lesson_order: f === file ? 0 : 1, sg_title: f === file ? savedDocumentTitle(text, '') : '' } }) }, vault: {
  getAbstractFileByPath: p => p === path ? file : null, getMarkdownFiles: () => [file, prep],
  cachedRead: async () => text, process: async (_file, update) => { text = update(text); },
} };
const s = { app, device: { userId: 'dad' }, settings: {}, store: { get: async key => store.get(key), put: async (key, value) => store.set(key, value) } };
const ai = { askServer: async (question, _reading, opts) => {
  sent.push(opts.state); if (accountSwap) s.device.userId = 'other';
  return { text: 'I’ll update the saved title.', model: 'Fixture', ms: 1, actions: question.startsWith('Rename') ? [{ do: 'rename_document', path, title: 'My Current Lesson' }] : [] };
} };
function view() {
  const v = new AskView({}, s, ai, {}, {}); v.app = app;
  v.inputEl = el(); v.logEl = el(); v.pageEl = el(); v.presetsEl = el();
  v.renderHeader = () => {}; v.renderStatusLine = () => {}; return v;
}
let v = view(); v.documentPath = path; v.documentUser = 'dad'; v.showingPage = true;
v.showChat();
await v.send('Rename this to My Current Lesson', 'vault');
assert.equal(sent.at(-1).currentDocument.path, path, 'Switching to conversation retains the lesson');
assert.equal(savedDocumentTitle(text, ''), 'My Current Lesson');
assert.ok(text.endsWith('\n\n## Questions\nWhat will you do?\n[[D&C 13]]\n'));
assert.equal(file.path, path, 'Stable document identity keeps links, discussion and sharing intact');
assert.ok(notices.includes('Renamed to “My Current Lesson”.'));
assert.ok(store.get(`ai:document-chat:dad:${path}`).length === 2);
v = view(); await v.send('Rename my current lesson to My Current Lesson', 'vault');
assert.equal(sent.at(-1).currentDocument.path, path, 'Reopened chat resumes per-account saved context');
v = view(); await v.send('What does Alma 36 mean?', 'vault');
assert.equal(sent.at(-1).currentDocument, undefined, 'Unrelated questions do not attach a private lesson');
await v.send('Create a new lesson about kindness', 'vault');
assert.equal(sent.at(-1).currentDocument, undefined);
const prior = sent.length;
store.clear(); const second = new TFile('Library/Lessons/Other/Other.md');
app.vault.getMarkdownFiles = () => [file, prep, second];
v = view(); await v.send('Rename my current lesson to My Current Lesson', 'vault');
assert.equal(sent.length, prior+1, 'Missing document context reaches AI for clarification instead of a blocking folder picker');
assert.equal(sent.at(-1).currentDocument,undefined);
assert.ok(!elements.some(e => e.text === 'Which saved document do you mean?'));
await v.rememberDocument(path);
await v.send('Rename my current lesson to My Current Lesson','vault');
assert.equal(sent.at(-1).currentDocument.path,path,'An explicitly selected document still supports editing');
const unchanged = text;
await assert.rejects(renameDocument(s, { path, base }, path, 'Stale'), /changed while AI/);
await assert.rejects(renameDocument(s, undefined, path, 'Wrong'), /own saved/);
await assert.rejects(renameDocument(s, { path: 'other', base: text }, path, 'Wrong'), /own saved/);
assert.equal(text, unchanged);
v = view(); v.readOnlyDocument = true;
const callsBeforeShared = sent.length;
await v.send('Rename this shared lesson to Mine', 'vault');
assert.equal(sent.length, callsBeforeShared);
assert.equal(text, unchanged, 'A shared read-only page never falls back to editing the reader’s own lesson');
accountSwap = true; v = view(); await v.send('Rename my current lesson to Another title', 'vault');
assert.equal(text, unchanged, 'Switching accounts while waiting cannot mutate the former account document');
console.log('Document chat: retained context, reopened chat, isolated accounts, real rename, preserved content and links, ambiguity choice, unrelated requests, and stale-edit protection passed.');
