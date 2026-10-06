import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/ai/readingContext.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const read = (...args) => JSON.parse(JSON.stringify(context.exports.readingContext(...args)));
assert.deepEqual(read('AI Library/01 Scriptures/Canonical/Revelation 1.md', 'Old lesson', null), { chapterTitle: 'Revelation 1', page: 'AI Library/01 Scriptures/Canonical/Revelation 1.md', verseId: null });
assert.equal(read('Library/My Study/1 Nephi 3 - My Notes.md', null, null).chapterTitle, '1 Nephi 3');
assert.equal(read('Alma 36#^alma-36-3', 'Revelation 1', null).verseId, 'alma-36-3');
assert.equal(read(null, 'D&C 121', 'dc-121-1').chapterTitle, 'D&C 121');
assert.equal(read(null, null, null), null);
assert.equal(read('Library/Lessons/Trust/Trust.md', 'Revelation 1', null).chapterTitle, 'Trust');
console.log('Reading context checks passed: displayed page, personal chapter, verse, lazy reader, no page, document.');

// Exercise the actual command path: ReaderView state must win over a stale
// Markdown file, even before lazy loading has populated Obsidian's cache.
const main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('main.ts', main, ts.ScriptTarget.ES2022, true);
const method = ast.statements.filter(ts.isClassDeclaration).flatMap(c => [...c.members]).find(m => ts.isMethodDeclaration(m) && m.name.getText(ast) === 'openAsk');
assert.ok(method);
const anchors = [], overlays = [];
class AskView { setAnchor(...args) { anchors.push(args); } openOverlay(path) { overlays.push(path); } }
const leaf = { view: new AskView() };
const runtime = vm.createContext({ AskView, ASK_VIEW: 'ask', READER_VIEW: 'reader', LIBRARY_VIEW: 'library', SHARED_LESSON_VIEW: 'shared-lesson', projectDocument: () => null });
vm.runInContext(ts.transpileModule(`class Test { ${method.getText(ast)} }; globalThis.Test = Test;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, runtime);
const plugin = new runtime.Test();
plugin.app = { metadataCache: { getFirstLinkpathDest: () => null }, workspace: { activeLeaf: { view: { getViewType: () => 'reader', getState: () => ({ chapter: 'Revelation 1' }) } }, getLeavesOfType: () => [leaf], rightSplit: { collapse() {} }, getActiveFile: () => ({ path: 'Library/Lessons/Old.md' }) } };
await plugin.openAsk(null, null);
assert.equal(anchors[0][0], 'Revelation 1');
assert.equal(overlays[0], 'Revelation 1');
console.log('Ask command checks passed: reader chapter wins over stale active file before metadata exists.');
