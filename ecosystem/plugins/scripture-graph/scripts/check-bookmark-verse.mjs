// Returning to a chapter must return to the VERSE, not the page. A chapter is
// modelled as Obsidian renders one: a preview surface built after the view, in
// pieces, with the plugin's own decorations arriving afterwards.
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/bookmark-verse'); mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `import {trackBookmarkPosition} from './src/study/bookmarkPosition'; import {captureReadingPosition} from './src/study/readingPosition'; import {bookmarkContent,parseBookmark,placeLabel} from '@scripture-graph/core-sdk'; window.api={trackBookmarkPosition,captureReadingPosition,bookmarkContent,parseBookmark,placeLabel};`, resolveDir: process.cwd() }, bundle: true, format: 'iife', outfile: path.join(out, 'test.js'),
  plugins: [{ name: 'obsidian-boundary', setup(b) { b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'fixture' })); b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export class TFile {};export class MarkdownView {};export function requestUrl(){};` })) } }]
});
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101d29;color:#eee;font:20px/1.6 Georgia}main{height:740px;overflow:hidden}.markdown-preview-view{height:740px;overflow:auto;overflow-anchor:none;padding:0 18px}p{margin:0 0 1em}</style><main></main>');
  await page.addScriptTag({ path: path.join(out, 'test.js') });
  await page.evaluate(() => {
    window.db = new Map(); window.mark = 'jace:mark1'; window.surfaceDelay = 0; window.lazy = false; window.footnotes = false;
    const container = document.querySelector('main');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const verse = n => `<p data-verse-id="alma-36-${n}"><strong>${n}</strong> And it came to pass that I was three days and three nights in the most bitter pain and anguish of soul, and never, until I did cry out unto the Lord Jesus Christ${window.footnotes ? '<sup class="sg-fn">ᵃ</sup>' : ''} for mercy, did I receive a remission of verse ${n}.</p>`;
    window.surface = () => container.querySelector('.markdown-preview-view');
    window.render = async name => {
      container.replaceChildren();                       // the preview goes with the old page
      await sleep(window.surfaceDelay);
      const view = document.createElement('div'); view.className = 'markdown-preview-view'; container.append(view);
      const all = Array.from({ length: 48 }, (_, i) => verse(i + 1));
      if (!window.lazy) { view.innerHTML = all.join(''); return; }
      view.innerHTML = all.slice(0, 5).join('');         // a long chapter arrives in pieces
      setTimeout(() => { view.innerHTML = all.slice(0, 20).join(''); }, 260);
      setTimeout(() => { view.innerHTML = all.join(''); }, 620);
    };
    window.create = () => {
      window.view = {
        containerEl: container, state: null, getEphemeralState() { return {} }, setEphemeralState() {},
        async setState(name) { this.state = name; await window.render(name); }, onClose() {},
      };
      window.tracker = window.api.trackBookmarkPosition(window.view, {
        page: () => window.view.state, root: () => window.surface(),
        bookmark: async () => window.mark,
        read: async key => window.db.get(key) ?? null,
        write: async (key, position) => { window.db.set(key, structuredClone(position)) },
      });
    };
    window.create();
    // where a verse sits relative to the top of the reading surface
    window.verseTop = n => {
      const el = window.surface().querySelector(`[data-verse-id="alma-36-${n}"]`);
      return el ? Math.round(el.getBoundingClientRect().top - window.surface().getBoundingClientRect().top) : null;
    };
    window.readTo = n => {                               // read down to a verse, as a finger would
      const s = window.surface();
      s.dispatchEvent(new Event('touchmove', { bubbles: true }));
      s.scrollTop += window.verseTop(n);
      s.dispatchEvent(new Event('scroll'));
    };
    window.reopen = async () => { await window.view.setState('Home'); await window.view.setState('Alma 36') };
  });

  // 1. Read to verse 24, leave the page: the place saved is the verse itself.
  await page.evaluate(async () => { await window.view.setState('Alma 36'); window.readTo(24); window.tracker.flush() });
  const place = await page.evaluate(() => window.db.get('jace:mark1'));
  assert.equal(place.mark.id, 'alma-36-24', 'the saved place names the verse');
  assert.ok(place.top > 100, 'and still carries the offset it was saved at');
  assert.match(await page.evaluate(() => window.api.placeLabel(window.db.get('jace:mark1'))), /^Verse 24 · /, 'and the bookmark list can say where that is');

  // 2. Reopening lands on that verse, at the same place on the screen.
  await page.evaluate(() => window.reopen());
  await page.waitForFunction(() => window.verseTop(24) !== null && Math.abs(window.verseTop(24)) <= 2);

  // 3. Larger type: every offset in the page moves, and the verse still wins.
  const before = await page.evaluate(() => window.db.get('jace:mark1').top);
  await page.evaluate(async () => { document.body.style.fontSize = '30px'; await window.reopen() });
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2);
  const after = await page.evaluate(() => window.surface().scrollTop);
  assert.ok(Math.abs(after - before) > 120, `the remembered offset alone would have missed by ${Math.round(Math.abs(after - before))}px`);
  await page.evaluate(() => { document.body.style.fontSize = '' });

  // 4. The verse survives the page's own decorations changing its words.
  await page.evaluate(async () => { window.footnotes = true; await window.reopen() });
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2);
  await page.evaluate(() => { window.footnotes = false });

  // 5. A long chapter that renders in pieces: the passage is not there to scroll
  //    to when the page opens, and the aim is retaken until it is.
  await page.evaluate(async () => { window.lazy = true; await window.reopen() });
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2, null, { timeout: 5000 });
  await page.evaluate(() => { window.lazy = false });

  // 6. A reading surface Obsidian builds late is waited for, not given up on.
  await page.evaluate(async () => { window.surfaceDelay = 700; await window.reopen() });
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2, null, { timeout: 5000 });
  await page.evaluate(() => { window.surfaceDelay = 0 });

  // 7. A finger resting on the page while it opens is not the reader taking over.
  await page.evaluate(async () => {
    window.lazy = true; const opening = window.reopen();
    await new Promise(r => setTimeout(r, 120));
    window.surface().dispatchEvent(new Event('touchstart', { bubbles: true }));
    await opening; window.lazy = false;
  });
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2, null, { timeout: 5000 });

  // 8. Actually reading the page does stop it: no snap back afterwards.
  await page.evaluate(async () => {
    const opening = window.reopen();
    await new Promise(r => setTimeout(r, 60));
    const s = window.surface(); s.dispatchEvent(new Event('touchmove', { bubbles: true })); s.scrollTop = 80; s.dispatchEvent(new Event('scroll'));
    await opening;
  });
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.surface().scrollTop), 80, 'the reader keeps the page they moved');

  // 9. Places saved before verses were remembered still resume, by their wording.
  await page.evaluate(async saved => {
    await window.view.setState('Home');            // leave first: the place saved on leaving is this device's own
    window.db.set('jace:mark1', { top: saved.top, left: 0, anchor: saved.anchor });
    await window.view.setState('Alma 36');
  }, place);
  await page.waitForFunction(() => Math.abs(window.verseTop(24)) <= 2, null, { timeout: 5000 });
  // and once the reader settles in, the place is kept as a verse from then on
  await page.evaluate(() => { const s = window.surface(); s.dispatchEvent(new Event('touchmove', { bubbles: true })); s.dispatchEvent(new Event('scroll')) });
  await page.waitForFunction(() => window.db.get('jace:mark1').mark?.id === 'alma-36-24', null, { timeout: 5000 });

  // 10. A bookmark with no place at all opens at the top, as it always did.
  await page.evaluate(async () => { await window.view.setState('Home'); window.db.delete('jace:mark1'); await window.view.setState('Alma 36') });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.surface().scrollTop), 0, 'a page-only bookmark still opens its page');
  await page.evaluate(() => window.tracker.dispose());

  // The place rides in the bookmark record, verse and all, for other devices.
  const round = await page.evaluate(() => {
    const content = window.api.bookmarkContent({ path: 'Library/Scriptures/Alma 36.md', title: 'Alma 36', place: { top: 1234, left: 0, anchor: { tag: 'p', text: '24 And it came to pass', offset: -12 }, mark: { id: 'alma-36-24', offset: -12 } }, at: '2026-09-25T00:00:00.000Z' });
    return window.api.parseBookmark(content).record.place;
  });
  assert.deepEqual(round.mark, { id: 'alma-36-24', offset: -12 }, 'the verse survives the bookmark record');
  console.log('Bookmark verse positions passed: verse captured, exact spot restored, larger type, changed wording, chapters rendered in pieces, a late reading surface, a resting finger, the reader taking over, older places migrated, page-only bookmarks and the synced record.');
} finally { await browser.close(); }
