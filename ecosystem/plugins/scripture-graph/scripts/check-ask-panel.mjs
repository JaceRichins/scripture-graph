import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/ai/askView.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const listeners = new Set();
let focused = 0, blurred = 0, restored = 0, removed = 0, panel, backdrop;
const parent = { appendChild() { restored++; } };
const content = { parentElement: parent };
class ItemView { constructor() { this.contentEl = content; this.app = {}; } }
class TFile { constructor(path) { this.path = path; this.basename = path.split('/').pop().replace(/\.md$/, ''); this.stat = { mtime: 1 }; } }
let keyboardHeight = 0, keyboardChanged, disconnected = false;
const document = { documentElement: { clientHeight: 800 }, body: { createDiv(options) {
  if (options.cls === 'sg-ai-backdrop') return backdrop = { style: { setProperty(key, value) { this[key] = value; } }, remove() { this.removed = true; } };
  panel = { style: { setProperty(key, value) { this[key] = value; } }, classList: { toggle() {} },
    appendChild() {}, addEventListener() {}, remove() { removed++; } };
  return panel;
} } };
const platform = { isMobile: true };
let previewText = '';
const MarkdownRenderer = { render: async (_app, text) => { previewText = text; } };
const viewport = { height: 420, offsetTop: 12,
  addEventListener(name, fn) { listeners.add(fn); },
  removeEventListener(name, fn) { listeners.delete(fn); } };
const context = vm.createContext({ exports: {}, document,
  getComputedStyle: () => ({ getPropertyValue: () => `${keyboardHeight}px` }),
  MutationObserver: class { constructor(fn) { keyboardChanged = fn; } observe() {} disconnect() { disconnected = true; } },
  require: name => name === 'obsidian' ? { ItemView, TFile, MarkdownRenderer, Platform: platform, Notice: class {} } : name === '../state' ? { PERSONAL_PREFIX: 'Library/' } : name === './documentContext' ? { documentTitle: (_app, file) => file.basename } : { safeMarkdown: () => true },
  window: { visualViewport: viewport, innerHeight: 800, screen: { height: 800 }, addEventListener() {}, removeEventListener() {} } });
vm.runInContext(code, context);
const view = new context.exports.AskView({}, {}, {}, {}, {});
view.refreshResearchAllowance = async () => {};
view.inputEl = { value: '', focus() { focused++; }, blur() { blurred++; } };
view.setAnchor('Alma 35', null);
view.inputEl.value = 'Explain this simply';
view.setAnchor('Alma 35', 'alma-35-3', 'Selected from Alma 35:3:\n“Selected verse”\n\nMy request: ');
assert.equal(view.inputEl.value, 'Explain this simply', 'Selection must not replace the user draft');
assert.equal(view.selectedContext, 'Selected from Alma 35:3:\n“Selected verse”');
view.setAnchor('John 3', null);
assert.equal(view.selectedContext, null, 'Opening another page clears old selection context');
assert.equal(focused, 0, 'Opening mobile AI must not summon the keyboard');
view.showMobile();
assert.equal(panel.style.height, '420px');
assert.equal(panel.style.top, '12px');
viewport.height = 340;
for (const fn of listeners) fn();
assert.equal(panel.style.height, '340px', 'Workspace shrinks with the keyboard');
viewport.height = 800;
viewport.offsetTop = 0;
keyboardHeight = 350;
keyboardChanged();
assert.equal(panel.style.height, '450px', 'Native iOS inset works even when visualViewport never shrinks');
viewport.height = 450;
keyboardChanged();
assert.equal(panel.style.height, '450px', 'Native and browser insets must not be subtracted twice');
assert.equal(backdrop.style.height, '800px', 'Opaque backdrop stays full-height behind the keyboard');
keyboardHeight = 0;
viewport.height = 800;
keyboardChanged();
assert.equal(panel.style.height, '800px', 'Closing keyboard restores full height');
assert.equal(listeners.size, 1);
view.showMobile();
assert.equal(listeners.size, 1, 'Opening twice must not add another panel');
view.closeMobile();
assert.equal(restored, 1, 'Closing restores the chat view without replacing the reading leaf');
assert.equal(listeners.size, 0, 'Viewport handlers are removed on close');
assert.equal(removed, 1);
assert.equal(backdrop.removed, true, 'Closing restores the reading background');
assert.ok(disconnected, 'Native keyboard observer is removed on close');
assert.ok(blurred > 0);
platform.isMobile = false;
view.setAnchor('Alma 36', null);
assert.equal(focused, 1, 'Desktop retains input focus');
view.renderHeader = () => {};
view.pageEl = { hidden: true, setText() {}, empty() {}, createEl() { return {}; }, createDiv() { return { createEl() { return {}; } }; } };
view.logEl = { hidden: false };
view.presetsEl = { hidden: false };
view.host = { ensure: async () => true };
const file = { path: 'Alma 36.md', basename: 'Alma 36' };
view.app = { workspace: { getActiveFile: () => file }, metadataCache: { getFirstLinkpathDest: () => file }, vault: { cachedRead: async () => 'First verse ^alma-36-1\nSecond verse ^alma-36-2' } };
view.inputEl.value = 'Unsent lesson idea';
await view.showPage('Alma 36#^alma-36-2');
assert.equal(previewText, 'Second verse ^alma-36-2');
assert.equal(view.logEl.hidden, true);
assert.equal(view.inputEl.value, 'Unsent lesson idea');
view.showChat();
assert.equal(view.pageEl.hidden, true);
assert.equal(view.logEl.hidden, false);
assert.equal(view.inputEl.value, 'Unsent lesson idea');
console.log('AI panel checks passed: no mobile autofocus, keyboard viewport fit, single panel, cleanup, desktop focus.');
console.log('Page preview checks passed: exact verse, return to chat, unsent draft preserved.');
const elements = [];
function element(tag, options = {}) {
  const el = { tag, text: options.text, value: '', hidden: false,
    empty() {}, setText(text) { this.text = text; },
    createEl(childTag, options) { return element(childTag, options); },
    createDiv(options) { return element('div', options); } };
  elements.push(el);
  return el;
}
let stored, created;
view.s = { store: { get: async () => null, put: async (_key, value) => { stored = value; } } };
view.pageEl = element('div');
view.app.vault.getAbstractFileByPath = () => true;
view.app.vault.getMarkdownFiles = () => [];
view.app.vault.create = async (path, text) => { created = { path, text }; };
await view.showDraft();
const titleInput = elements.find(e => e.tag === 'input');
const draftBody = elements.find(e => e.tag === 'textarea');
titleInput.value = 'Sunday lesson'; draftBody.value = 'Our discussion questions';
draftBody.oninput();
await view.draftWrites;
assert.equal(stored.body, 'Our discussion questions');
view.showChat();
elements.length = 0;
await view.showDraft();
assert.equal(elements.find(e => e.tag === 'textarea').value, 'Our discussion questions');
await elements.find(e => e.text === 'Create Markdown file').onclick();
assert.ok(created.path.startsWith('Library/AI Notes/Sunday lesson ('));
assert.ok(created.text.includes('Our discussion questions'));
const createdPath = created.path;
const existing = new TFile(createdPath);
let disk = created.text;
view.app.vault.getAbstractFileByPath = () => existing;
view.app.vault.process = async (_file, update) => { disk = update(disk); };
const editBody = elements.find(e => e.tag === 'textarea');
editBody.value = '# Revised lesson\nOur updated discussion';
editBody.oninput();
await view.draftWrites;
await elements.find(e => e.text === 'Save changes').onclick();
assert.ok(disk.includes('# Revised lesson'));
assert.ok(disk.startsWith('---\nownership: personal'));
assert.equal(view.draft.path, createdPath, 'Saving edits updates the same Markdown file');
disk += '\nChanged by sync';
editBody.value = 'Unsaved local revision'; editBody.oninput();
await elements.find(e => e.text === 'Save changes').onclick();
assert.ok(disk.endsWith('Changed by sync'), 'Concurrent changes must not be overwritten');
assert.equal(view.draft.body, 'Unsaved local revision');
console.log('Draft checks passed: typing persists locally and survives switching to Conversation and back.');
console.log('Markdown checks passed: create, edit in place, preserve frontmatter, protect concurrent changes.');

// Exercise the production citation handler and the constructor's navigation
// wrapper together: a delayed/failing open must not hide the conversation.
const destinations = [];
let finishOpen, rejectOpen, closedCitations = 0;
const citationView = new context.exports.AskView({}, {device:{userId:'reader'}}, {}, {}, {
  openNote: target => { destinations.push(target); return new Promise((resolve,reject)=>{finishOpen=resolve;rejectOpen=reject}); },
});
citationView.app = {metadataCache:{getFirstLinkpathDest:path=>({path})}};
citationView.inputEl = {value:'Keep this unsent question'};
citationView.turns = [{role:'assistant',text:'Read [[Alma 36#^alma-36-2]].'}];
citationView.pageEl = {hidden:true};citationView.logEl = {hidden:false};
citationView.showPage = () => { throw new Error('Citation must never open the embedded preview'); };
citationView.editableDocument = path => path.startsWith('Library/Lessons/');
citationView.rememberDocument = async path => {citationView.remembered=path};
citationView.closeMobile = () => { closedCitations++;citationView.mobilePanel=null; };
const tap = (target,internal=true) => ({target:{closest:selector=>internal && selector==='a.internal-link' ? {dataset:{href:target},getAttribute:()=>target}:null},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}});
const chat = {classList:{contains:()=>true}};
citationView.mobilePanel=chat;
const citation=tap('Alma 36#^alma-36-2');const opening=citationView.followCitation(citation);
assert.equal(citation.prevented,true);assert.equal(citation.stopped,true);
assert.equal(citationView.mobilePanel,chat,'Keep chat visible until the destination opens');
finishOpen();await opening;
assert.equal(destinations.at(-1),'Alma 36#^alma-36-2');assert.equal(closedCitations,1);
assert.equal(citationView.anchorVerse,'alma-36-2');assert.equal(citationView.pageEl.hidden,true);assert.equal(citationView.logEl.hidden,false);
assert.equal(citationView.inputEl.value,'Keep this unsent question');assert.equal(citationView.turns.length,1);
citationView.mobilePanel=chat;
const failing=citationView.followCitation(tap('Unavailable page'));rejectOpen(new Error('Offline'));await failing;
assert.equal(citationView.mobilePanel,chat);assert.equal(closedCitations,1);
// Links in document discussions also navigate, with same-document anchors resolved.
citationView.showingPage=true;citationView.pageLink='Library/Lessons/Test/Lesson.md#Old heading';
const anchor=citationView.followCitation(tap('#Discussion'));finishOpen();await anchor;
assert.equal(destinations.at(-1),'Library/Lessons/Test/Lesson.md#Discussion');assert.equal(citationView.remembered,'Library/Lessons/Test/Lesson.md');
assert.equal(citationView.anchorVerse,null);
// Desktop citations use the same page-opening route; ordinary web links retain
// Obsidian's external-link behavior and are not intercepted.
citationView.mobilePanel=null;const desktop=citationView.followCitation(tap('John 3'));finishOpen();await desktop;
assert.equal(destinations.at(-1),'John 3');
const external=tap('https://www.churchofjesuschrist.org/',false);await citationView.followCitation(external);
assert.equal(external.prevented,undefined);assert.equal(destinations.length,4);
console.log('Citation navigation passed: real page route, verse/heading anchors, deferred close, failure retention, conversation/draft preservation, document discussion, desktop, and external-link passthrough.');
