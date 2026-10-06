// Existing highlights and notes must paint exactly as they did. Runs the real
// decorateVerse (src/social/annotations.ts) in Chromium against every kind of
// saved mark -- whole-verse colours, a phrase, each style, a theme tag, a
// note, a connection, a flashcard, a bookmark, a shared mark -- and compares
// what lands inside the verse with the golden captured before the 22 Sep 2026
// reading-controls work (scripts/golden/marks-render.json).
//   node scripts/check-marks-render.mjs            compare
//   node scripts/check-marks-render.mjs --update   re-capture (only on purpose)
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const GOLDEN = new URL('./golden/marks-render.json', import.meta.url);

const obsidianStub = `export class Modal { constructor(app){ this.app = app; this.contentEl = document.createElement('div'); this.modalEl = document.createElement('div'); } open(){} close(){} }
export class Menu { addItem(){ return this; } addSeparator(){ return this; } showAtMouseEvent(){} }
export class Notice { constructor(){} }
export class TFile {}
export const Platform = { isMobile: true };
class Base {} export { Base as App, Base as Component, Base as ItemView, Base as MarkdownRenderChild, Base as MarkdownView, Base as Plugin, Base as PluginSettingTab, Base as Setting, Base as TFolder, Base as WorkspaceLeaf };
export const MarkdownRenderer = { render: async () => {} };
export const normalizePath = p => p; export const requestUrl = async () => ({}); export const setIcon = () => {};`;
const bundle = await esbuild.build({
  stdin: { contents: `export { decorateVerse, AnnotationService } from './src/social/annotations';`, resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'ts' },
  bundle: true, format: 'iife', globalName: 'SG', write: false, platform: 'browser', target: 'es2022',
  plugins: [{ name: 'obsidian', setup(b) {
    b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: obsidianStub, loader: 'js' }));
  } }],
  loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.css': 'empty' }, logLevel: 'silent',
});
const code = bundle.outputFiles[0].text;

const me = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
let n = 0;
const row = (over) => ({ annotation_id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, author_user_id: me,
  anchor_type: 'verse', anchor_id: 'mosiah-5-7', selected_text: null, start_offset: null, end_offset: null, text_hash: null,
  content: '', color: null, style: null, theme: null, visibility: 'private', group_id: null,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', deleted_at: null, version: 1, ...over });
const CASES = {
  'whole verse, yellow': [row({ annotation_type: 'highlight', color: 'yellow' })],
  'whole verse, each colour': ['green', 'blue', 'pink', 'orange'].map(color => row({ annotation_type: 'highlight', color })),
  'phrase, underline': [row({ annotation_type: 'highlight', color: 'blue', style: 'underline', selected_text: 'children of Christ' })],
  'phrase, bold and italic': [row({ annotation_type: 'highlight', color: 'green', style: 'bold', selected_text: 'the covenant' }),
    row({ annotation_type: 'highlight', color: 'pink', style: 'italic', selected_text: 'spiritually begotten you' })],
  'theme tag': [row({ annotation_type: 'highlight', style: 'theme', theme: 'Covenants', color: '#8fd3c1' })],
  'note': [row({ annotation_type: 'note', content: 'The name is given after the covenant.' })],
  'quoted note': [row({ annotation_type: 'note', content: '> "children of Christ"\n\nA new family name.' })],
  'connection': [row({ annotation_type: 'note', content: 'Connect: [[Mosiah 27#^mosiah-27-25]] — born again' })],
  'flashcard': [row({ annotation_type: 'study-marker', content: JSON.stringify({ front: 'Mosiah 5:7', back: 'children of Christ', card: { ease: 2.5, intervalDays: 1, due: '2026-09-02', reps: 0 } }) })],
  'bookmark': [row({ annotation_type: 'bookmark', anchor_type: 'chapter', anchor_id: 'mosiah-5', content: 'Bookmark: [[Mosiah 5]]\nsg-bookmark {"v":1,"path":"Mosiah 5","title":"Mosiah 5","place":"v7","at":"2026-09-01T00:00:00Z"}' })],
  'deleted mark is ignored': [row({ annotation_type: 'highlight', color: 'yellow', deleted_at: '2026-09-02T00:00:00Z' })],
  'everything at once': null,
};
CASES['everything at once'] = Object.entries(CASES).filter(([k, v]) => v && !k.startsWith('deleted')).flatMap(([, v]) => v);
const SOCIAL = [{ ...row({ annotation_type: 'highlight', color: 'green', author_user_id: other, visibility: 'group' }), author_name: 'Anna' },
  { ...row({ annotation_type: 'note', content: 'Shared thought', author_user_id: other, visibility: 'group' }), author_name: 'Anna' }];

const browser = await chromium.launch({ headless: true });
const results = {};
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: `
    const P = HTMLElement.prototype;
    P.addClass = function (...c) { this.classList.add(...c.flatMap(x => x.split(' ').filter(Boolean))); };
    P.removeClass = function (...c) { this.classList.remove(...c); };
    P.toggleClass = function (c, on) { this.classList.toggle(c, on); };
    P.hasClass = function (c) { return this.classList.contains(c); };
    P.setAttr = function (k, v) { this.setAttribute(k, v); };
    P.empty = function () { this.innerHTML = ''; };
    P.setText = function (t) { this.textContent = t; };
    P.createEl = function (tag, o = {}) { const e = document.createElement(tag); if (o.cls) e.className = Array.isArray(o.cls) ? o.cls.join(' ') : o.cls;
      if (o.text) e.textContent = o.text; if (o.attr) for (const [k, v] of Object.entries(o.attr)) e.setAttribute(k, v); this.appendChild(e); return e; };
    P.createDiv = function (o) { return this.createEl('div', o); };
    P.createSpan = function (o) { return this.createEl('span', o); };
    ${code}` });
  for (const [name, mine] of Object.entries(CASES)) for (const withSocial of [false, true]) {
    const html = await page.evaluate(({ mine, social, me }) => {
      document.body.innerHTML = '<div class="markdown-preview-view"><p data-verse-id="mosiah-5-7"><strong>7</strong> And now, because of the covenant which ye have made ye shall be called the children of Christ, his sons, and his daughters; for behold, this day he hath spiritually begotten you.</p></div>';
      const p = document.querySelector('p');
      const s = { device: { userId: me, showScopes: { mine: true, groups: {}, public: true } }, settings: { themes: [{ name: 'Covenants', color: '#8fd3c1', style: 'theme' }] }, app: {} };
      const svc = { mine: async () => mine, social: () => social };
      SG.decorateVerse(s, svc, p, 'mosiah-5-7', mine, social);
      SG.decorateVerse(s, svc, p, 'mosiah-5-7', mine, social);   // re-decorating must be idempotent
      return p.outerHTML;
    }, { mine, social: withSocial ? SOCIAL : [], me });
    results[`${name}${withSocial ? ' + shared' : ''}`] = html;
  }
  // Notes beside verses (22 Sep 2026): the line sits after the verse, never in it.
  const beside = await page.evaluate(({ note, quoted, conn, me }) => {
    const run = (mine) => {
      const p = document.querySelector('p');
      const s = { device: { userId: me, showScopes: { mine: true, groups: {}, public: true } }, settings: { themes: [] }, app: {} };
      SG.decorateVerse(s, { mine: async () => mine, social: () => [] }, p, 'mosiah-5-7', mine, []);
      return [...document.querySelectorAll('.sg-margin-note')].map(e => ({ text: e.textContent, for: e.dataset.sgNoteFor, inVerse: !!e.closest('p') }));
    };
    document.body.innerHTML = '<div class="markdown-preview-view"><div><p data-verse-id="mosiah-5-7"><strong>7</strong> And now, because of the covenant which ye have made ye shall be called the children of Christ.</p></div></div>';
    const first = run([note]), again = run([note]), both = run([note, quoted]), connOnly = run([conn]), gone = run([]);
    return { first, again, both, connOnly, gone };
  }, { note: CASES['note'][0], quoted: { ...CASES['quoted note'][0], updated_at: '2026-09-03T00:00:00Z' }, conn: CASES['connection'][0], me });
  assert.deepEqual(beside.first, [{ text: 'The name is given after the covenant.', for: 'mosiah-5-7', inVerse: false }]);
  assert.deepEqual(beside.again, beside.first, 're-decorating must not add a second line');
  assert.deepEqual(beside.both, [{ text: 'A new family name.+1', for: 'mosiah-5-7', inVerse: false }], 'newest first, quoted phrase stripped, count of the rest');
  assert.deepEqual(beside.connOnly, [], 'a connection is shown by its own chip, not as a note');
  assert.deepEqual(beside.gone, [], 'removing the note removes its line');
  results.__beside = 'checked';
} finally { await browser.close(); }

if (process.argv.includes('--update') || !existsSync(GOLDEN)) {
  mkdirSync(new URL('./golden/', import.meta.url), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(results, null, 1) + '\n');
  console.log(`Marks render golden captured: ${Object.keys(results).length} cases.`);
} else {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  for (const [k, v] of Object.entries(golden)) assert.equal(results[k], v, `existing marks paint differently: ${k}`);
  assert.equal(results.__beside, 'checked');
  console.log(`Marks render checks passed: ${Object.keys(golden).length} cases paint exactly as before (colours, phrases, styles, themes, notes, connections, flashcards, bookmarks, shared, idempotent); notes beside verses sit outside the verse, newest first, once.`);
}
