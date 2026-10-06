import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
class TFile { constructor(path) { this.path = path; this.basename = path.split('/').pop().replace(/\.md$/, ''); } }
const context = vm.createContext({ exports: {}, require: () => ({ TFile, safeVaultLink: () => true }) });
const source = fs.readFileSync(new URL('../src/ai/lessonFiles.ts', import.meta.url), 'utf8');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const entries = new Map(), texts = new Map();
const original = new TFile('AI Library/Proverbs 3.md');
texts.set(original.path, '---\nownership: system\n---\n# Proverbs 3\nTrust in the Lord.');
const state = { app: { vault: {
  getAbstractFileByPath: path => entries.get(path),
  createFolder: async path => entries.set(path, {}),
  create: async (path, text) => { assert.ok(!entries.has(path)); entries.set(path, new TFile(path)); texts.set(path, text); },
  cachedRead: async file => texts.get(file.path),
}, metadataCache: { getFirstLinkpathDest: ref => ref === 'Proverbs 3' ? original : null } } };
const docs = [{ title: 'Family lesson', markdown: '# Lesson\nRead [[Proverbs 3]]. See [[Handout]]. [[Missing source]]' }, { title: 'Handout', markdown: 'Read [[Proverbs 3#^prov-3-5]]. [Source](https://example.com/source)' }];
const result = await context.exports.saveLessonFiles(state, { ensure: async () => true }, docs);
assert.equal(result.documents.length, 2);
assert.equal(result.copied, 1);
assert.ok(texts.has(`${result.folder}/Resources/Reference - Proverbs 3.md`));
assert.ok(texts.get(`${result.folder}/Resources/Reference index.md`).includes('could not copy'));
assert.ok(texts.get(`${result.folder}/Resources/Reference index.md`).includes('https://example.com/source'));
assert.ok(texts.get(`${result.folder}/Resources/Reference - Proverbs 3.md`).startsWith('---\nownership: personal'));
assert.equal(result.documents[1], `${result.folder}/Resources/Handout.md`);
assert.ok(texts.get(result.documents[0]).includes(`[[${result.documents[1]}|Handout]]`));
assert.equal([...texts.keys()].filter(p => p.startsWith(result.folder + '/') && !p.includes('/Resources/')).length, 1);
const second = await context.exports.saveLessonFiles(state, { ensure: async () => true }, docs);
assert.notEqual(second.folder, result.folder);
assert.ok(texts.get(original.path).includes('ownership: system'));
console.log('Lesson bundle checks passed: grouped Markdown files, reference deduplication, source copies, missing-source reporting, no overwrites.');

// Action execution returns the explicit primary document, never a vault enumeration.
const actionContext = vm.createContext({ exports: {}, require: name => name === './lessonFiles' ? { saveLessonFiles: context.exports.saveLessonFiles } : name === 'obsidian' ? { TFile, Notice: class {} } : { approvedActions: actions => actions, approvedActionsKeepingSettings: actions => ({ actions, dropped: 0 }) } });   // this check is about lesson files, not the action policy
const actionSource = fs.readFileSync(new URL('../src/ai/actions.ts', import.meta.url), 'utf8');
vm.runInContext(ts.transpileModule(actionSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, actionContext);
let opened, delivered;
state.device = { lastShareScope: { visibility: 'private' } };
await actionContext.exports.perform(state, {}, { ensure: async () => true, openNote: async path => { opened = path; } }, docs.map(doc => ({ do: 'lesson', ...doc })), paths => { delivered = paths; });
assert.ok(delivered[0].endsWith('/Family lesson.md'));
assert.equal(opened, delivered[0]);
assert.equal(delivered.length, 2, 'Reference copies and index never become primary document candidates');
console.log('Lesson delivery checks passed: exact primary file is opened and returned to the AI workspace.');

await actionContext.exports.perform(state, {}, {ensure:async()=>true,openNote:async path=>{opened=path}}, [{do:'lesson',title:'Alma Study Plan',markdown:'# My plan\n- [ ] Read [[Proverbs 3]].'}], paths=>{delivered=paths},undefined,'study-plan');
assert.ok(opened.startsWith('Library/Study Plans/Alma Study Plan/'));
assert.equal(opened,delivered[0]);
assert.ok(texts.get(opened).includes('content_type: study-plan'));
assert.ok(texts.get(opened).includes('- [ ]'));
assert.ok(texts.get('Library/Study Plans/Alma Study Plan/Resources/Reference index.md').includes('Back to the study plan'));
console.log('Study-plan delivery passed: dedicated private folder, main document, checkboxes and separate resources.');
