import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
class TFile { constructor(path) { this.path = path; } }
const context = vm.createContext({ exports: {}, require: () => ({ TFile, safeVaultLink: () => true, safeMarkdown: () => true,
  // same rule as core-sdk actionPolicy: the personal shelves the assistant may revise
  personalDocumentPath: path => /^Library\/(Lessons|Study Plans|Research|AI Notes)\/.+\.md$/.test(path) }) });
const source = fs.readFileSync(new URL('../src/ai/documentEdit.ts', import.meta.url), 'utf8');
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const path = 'Library/Lessons/Trust/Lesson.md';
const file = new TFile(path);
let text = '---\nownership: personal\n---\n# Original\nMy notes.';
const base = text;
const s = { app: { vault: { getAbstractFileByPath: p => p === path ? file : null, process: async (_file, update) => { text = update(text); } } } };
await context.exports.editDocument(s, { path, base }, path, '# Revised\nA new activity.');
assert.ok(text.startsWith('---\nownership: personal\n---'));
assert.ok(text.includes('A new activity.'));
await assert.rejects(context.exports.editDocument(s, { path, base }, path, '# Stale'), /changed while AI/);
await assert.rejects(context.exports.editDocument(s, { path, base: text }, 'Library/Lessons/Other.md', '# Wrong'), /must target/);
await assert.rejects(context.exports.editDocument(s, undefined, path, '# Wrong'), /must target/);
await assert.rejects(context.exports.editDocument(s, { path, base: text }, path, ''), /empty/);
console.log('Document edit checks passed: exact file only, frontmatter preserved, stale edits rejected, empty edits rejected.');
