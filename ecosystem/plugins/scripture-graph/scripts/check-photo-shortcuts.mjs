import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/study/photoShortcuts.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const classes = new Set(), commands = [];
let listener, cleanup, captures, ensured = 0, changed = 0, restored = 0;
class Element {
  isConnected = true;
  blur() { document.activeElement = null; }
  focus(options) { assert.equal(options.preventScroll, true); restored++; document.activeElement = this; }
}
const input = new Element();
const document = { activeElement: input, body: { classList: {
  contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key),
} } };
const platform = { isMobile: false };
const context = vm.createContext({ exports: {}, document, window: {}, HTMLElement: Element,
  require: () => ({ Platform: platform }) });
vm.runInContext(compiled, context);
const plugin = { addCommand: c => commands.push(c), register: fn => { cleanup = fn; },
  registerDomEvent: (_window, type, fn, options) => { assert.equal(type, 'keydown'); listener = fn; captures = options.capture; } };
context.exports.registerPhotoShortcuts(plugin, () => { ensured++; }, () => { changed++; });
function press(key, options = {}) {
  const event = { key, ctrlKey: true, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...options };
  listener(event); return event;
}
assert.equal(captures, true);
assert.equal(press('p').stopped, true); assert(classes.has('sg-photo-only')); assert.equal(ensured, 1);
assert.equal(document.activeElement, null);
press('p', { repeat: true }); assert(classes.has('sg-photo-only')); assert.equal(ensured, 1);
press('n'); assert.equal(changed, 1); assert(classes.has('sg-photo-only'));
press('n', { repeat: true }); assert.equal(changed, 1);
press('Escape', { ctrlKey: false }); assert(!classes.has('sg-photo-only')); assert.equal(restored, 1);
assert.equal(document.activeElement, input);
assert.equal(press('Escape', { ctrlKey: false }).prevented, undefined);
assert.equal(press('p', { shiftKey: true }).prevented, undefined);
assert.equal(press('n', { altKey: true }).prevented, undefined);
press('p'); press('p'); assert(!classes.has('sg-photo-only'));
commands.find(c => c.id === 'toggle-photo-only').callback(); assert(classes.has('sg-photo-only'));
cleanup(); assert(!classes.has('sg-photo-only'));
platform.isMobile = true; listener = null;
context.exports.registerPhotoShortcuts(plugin, () => {}, () => {}); assert.equal(listener, null);
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
assert(css.includes('body.sg-photo-only > :not(.sg-scene) *'));
assert(css.includes('body.sg-photo-only .sg-scene::after { background: none !important; }'));
console.log('Photo shortcuts passed: capture overrides, toggle/next, no repeats, Escape/focus restoration, cleanup, mobile exclusion and photo-only styling.');
