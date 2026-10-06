import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(new URL('../src/study/' + file, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
class Element {
  clientHeight = 0; scrollHeight = 0; scrollWidth = 0; clientWidth = 0; parentElement = null;
  closest(selector) { return selector === '.workspace-leaf' ? (this.inLeaf ? this : null) : (this.editing ? this : null); }
  getClientRects() { return [1]; }
}
const body = new Element(), scroll = new Element(), root = new Element();
Object.assign(scroll, { clientHeight: 400, scrollHeight: 1400, scrollBy: opts => moves.push(opts.top) });
root.querySelectorAll = () => [scroll]; root.contains = el => el.inside === true;
let listener, mode = 'preview', kind = 'markdown', title = 'Genesis 50', overlays = [], selected = false;
const opened = [], moves = [], history = [];
const platform = { isMobile: false };
let photoOnly = false;
const document = { body: { classList: { contains: () => photoOnly } }, activeElement: body, querySelectorAll: () => overlays };
const core = { BOOKS: [{ slug: 'genesis', prefix: 'Genesis', chapters: 50 }, { slug: 'exodus', prefix: 'Exodus', chapters: 40 }],
  chapterIdFromTitle: t => /^(Genesis|Exodus) \d+$/.test(t) ? t.toLowerCase().replace(' ', '-') : null };
const state = { CANONICAL_PREFIX: 'Canonical/', PERSONAL_PREFIX: 'Library/', ANNOTATED_PREFIX: 'Annotated/' };
const modules = {};
const context = vm.createContext({ exports: {}, HTMLElement: Element, document,
  window: { getSelection: () => ({ isCollapsed: !selected }) }, getComputedStyle: el => ({ overflowY: 'auto', overflowX: el.horizontal ? 'auto' : 'visible' }),
  require: name => name === 'obsidian' ? { Platform: platform } : name === '@scripture-graph/core-sdk' ? core
    : name === '../state' ? state : name === './trace' ? { trace() {} } : modules[name],
});
for (const name of ['swipeNav', 'leafNav', 'keyboardNav']) {
  context.exports = {}; vm.runInContext('(function(){' + compile(name + '.ts') + '\n})();', context); modules['./' + name] = context.exports;
}
const leaf = { view: { containerEl: root, getViewType: () => kind, getMode: () => mode, getState: () => ({ chapter: title }) },
  history: { backHistory: [1], forwardHistory: [1], back: () => history.push('back'), forward: () => history.push('forward') } };
const s = { app: { workspace: { activeLeaf: leaf, getActiveFile: () => ({ path: 'Canonical/' + title + '.md', basename: title }) } } };
const plugin = { registerDomEvent: (_doc, event, fn) => { assert.equal(event, 'keydown'); listener = fn; } };
modules['./keyboardNav'].registerKeyboardNav(plugin, s, t => opened.push(t));
function key(key, opts = {}) {
  const event = { key, target: body, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...opts };
  listener(event); return event;
}
assert.equal(key('ArrowDown').prevented, true); key('ArrowUp'); assert.deepEqual(moves, [80, -80]);
key('ArrowRight'); assert.equal(opened.at(-1), 'Exodus 1');
title = 'Exodus 1'; key('ArrowLeft'); assert.equal(opened.at(-1), 'Genesis 50');
const count = opened.length;
photoOnly = true; key('ArrowRight'); photoOnly = false;
key('ArrowRight', { repeat: true }); key('ArrowRight', { shiftKey: true }); key('ArrowRight', { ctrlKey: true });
selected = true; key('ArrowRight'); selected = false;
overlays = [new Element()]; key('ArrowRight'); overlays = [];
const input = new Element(); input.editing = true; document.activeElement = input; key('ArrowRight'); document.activeElement = body;
mode = 'source'; key('ArrowRight'); mode = 'preview';
const sidebar = new Element(); sidebar.inLeaf = true; key('ArrowRight', { target: sidebar });
assert.equal(opened.length, count, 'typing, modifiers, selection, overlays, source mode, inactive panes and repeats must not turn pages');
title = 'Genesis 1'; assert.equal(key('ArrowLeft').prevented, undefined);
kind = 'scripture-graph-reader'; title = 'Genesis 50'; key('ArrowRight'); assert.equal(opened.at(-1), 'Exodus 1');
kind = 'sg-library'; key('ArrowLeft'); key('ArrowRight'); assert.deepEqual(history, ['back', 'forward']);
kind = 'canvas'; assert.equal(key('ArrowDown').prevented, undefined);
platform.isMobile = true; listener = null; modules['./keyboardNav'].registerKeyboardNav(plugin, s, () => {}); assert.equal(listener, null);
console.log('Keyboard navigation checks passed: active-page scrolling, chapter/book boundaries, reader state, library history, typing/selection/dialog/sidebar guards and mobile exclusion.');
