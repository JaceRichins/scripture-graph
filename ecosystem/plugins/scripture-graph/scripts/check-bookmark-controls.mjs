import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = '../../../output/bookmark-controls'; mkdirSync(out, {recursive:true});
await build({stdin:{contents:`import * as api from './src/study/bookmarkControls';window.api=api`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:out+'/controls.js'});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><body class="is-mobile is-phone theme-dark sg-dock-on"><div class="workspace-leaf-content" data-type="markdown"><header class="view-header"><div class="view-header-title-container"><div class="view-header-title">Alma 36</div></div><div class="view-actions"><button aria-label="More">•••</button></div></header><main class="markdown-preview-view"><h1>Alma 36</h1><p>Alma tells his son Helaman of his conversion and his trust in God.</p><h2>Remembering Jesus Christ</h2><p>18 Now, as my mind caught hold upon this thought, I cried within my heart: O Jesus, thou Son of God, have mercy on me...</p><p>19 And now, behold, when I thought this, I could remember my pains no more...</p></main></div><nav class="sg-dock"><div class="sg-dock-bar"><button class="sg-dock-slot" aria-label="Home">⌂</button><button class="sg-dock-slot" aria-label="Library">▤</button><button class="sg-dock-slot" aria-label="Search">⌕</button><button class="sg-dock-slot" aria-label="Ask AI">✧</button><button class="sg-dock-slot sg-dock-saved"></button><button class="sg-dock-slot" aria-label="Tabs">▢</button></div><button class="sg-dock-round" aria-label="Listen">♫</button></nav></body>`);
  await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});
  await page.addStyleTag({path:'styles.css'});
  await page.addStyleTag({content:`body{--view-header-height:60px;--font-ui-medium:17px;--font-ui-small:15px;--file-header-justify:center;--file-header-font-size:17px;--file-header-font-weight:600;background:#142a36;color:#f1ede3} .workspace-leaf-content{height:100vh;background:linear-gradient(150deg,#213847,#10252e)}.view-header{padding:18px 18px 0;height:85px;background:transparent}.view-actions button{background:rgba(20,20,22,.8);border-radius:50%;width:44px;height:44px}main{padding:25px!important;font:20px/1.6 Georgia;height:calc(100vh - 85px)}h1{font:36px Georgia}h2{font:26px Georgia}p{margin:28px 0} .sg-dock-slot{font-size:29px!important}`});
  await page.addScriptTag({path:out+'/controls.js'});
  await page.evaluate(()=>{
    window.currentPath='Alma 36.md';window.marks=new Map();window.adds=0;window.removes=0;window.saved=0;window.fail=false;window.lookupDelay=0;window.notices=0;
    window.opened=0;
    const current=()=>window.currentPath?{file:{path:window.currentPath},container:document.querySelector('.workspace-leaf-content')}:null;
    window.control=new window.api.BookmarkControls({current,
      lookup:async file=>{const mark=window.marks.get(file.path)??null;await new Promise(r=>setTimeout(r,window.lookupDelay));return mark},
      add:async file=>{if(window.fail)throw Error('fixture failure');window.adds++;window.marks.set(file.path,{annotation_id:file.path});await window.control.refresh()},
      open:()=>{window.opened++},error:()=>window.notices++
    });
    const button=document.querySelector('.sg-dock-saved');button.onclick=()=>window.control.toggle();window.control.mountButton(button,()=>window.saved++);
  });
  const button=page.locator('.sg-dock-saved');
  await page.waitForFunction(()=>!document.querySelector('.sg-dock-saved').disabled);
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.sg-bookmark-ribbon').count(),0);
  await button.tap();
  await page.waitForFunction(()=>document.querySelector('.sg-dock-saved').getAttribute('aria-pressed')==='true');
  assert.equal(await page.locator('.sg-bookmark-ribbon').count(),1);
  assert.equal(await button.getAttribute('aria-label'),'Bookmarked — see where you left off');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.sg-dock-saved path')).fill),'rgb(226, 196, 119)');
  await page.screenshot({path:out+'/bookmarked-phone.png'});
  // Holding opens the bookmark list exactly once and its release does not also open the sheet.
  await button.dispatchEvent('pointerdown',{button:0,pointerType:'touch'});await page.waitForTimeout(480);
  await button.dispatchEvent('pointerup',{button:0});await button.dispatchEvent('click');
  assert.equal(await page.evaluate(()=>window.saved),1);assert.equal(await page.evaluate(()=>window.opened),0);
  // Tapping the gold bookmark shows it; it never removes it.
  await button.tap();await page.waitForFunction(()=>window.opened===1);
  assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.sg-bookmark-ribbon').count(),1);
  // Removing it (from the sheet) clears the ribbon.
  await page.evaluate(async()=>{window.marks.delete('Alma 36.md');await window.control.refresh()});
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('.sg-bookmark-ribbon').count(),0);
  // Multiple rapid taps cannot create duplicate bookmarks.
  await page.evaluate(async()=>{await Promise.all([window.control.toggle(),window.control.toggle(),window.control.toggle()])});
  assert.equal(await page.evaluate(()=>window.adds),2);
  // Failed changes retain the real saved state and allow a retry.
  await page.evaluate(async()=>{window.marks.delete('Alma 36.md');await window.control.refresh();window.fail=true;await window.control.toggle();window.fail=false});
  assert.equal(await button.getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>window.notices),1);
  // A late refresh for an old chapter cannot light the new page's icon.
  await page.evaluate(async()=>{window.lookupDelay=80;const old=window.control.refresh();window.currentPath='Alma 37.md';window.lookupDelay=0;await window.control.refresh();await old});
  assert.equal(await button.getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.sg-bookmark-ribbon').count(),0);
  // Navigating during the toggle's lookup cannot add/remove either page's bookmark.
  await page.evaluate(async()=>{window.lookupDelay=80;const action=window.control.toggle();window.currentPath='Alma 38.md';await action;window.lookupDelay=0});
  assert.equal(await page.evaluate(()=>window.adds),2);
  // Header ribbon fits beside a long title at large UI text and the smallest phone width.
  await page.evaluate(async()=>{window.currentPath='Alma 36.md';window.marks.set('Alma 36.md',{annotation_id:'Alma 36.md'});document.querySelector('.view-header-title').textContent='A very long chapter or family history page title';await window.control.refresh()});
  await page.setViewportSize({width:320,height:700});await page.addStyleTag({content:'body{--font-ui-medium:24px}'});
  const ribbon=await page.locator('.sg-bookmark-ribbon').boundingBox();const more=await page.getByRole('button',{name:'More',exact:true}).boundingBox();
  assert.ok(ribbon.width>=14 && ribbon.x>=0 && ribbon.x+ribbon.width<=more.x);
  const touch=await button.boundingBox();assert.ok(touch.width>=44 && touch.height>=44);
  await page.screenshot({path:out+'/bookmarked-small-phone.png'});
  // Obsidian can hide the title on phones: the ribbon remains in the existing header.
  await page.evaluate(async()=>{document.body.classList.add('show-inline-title');await window.control.refresh()});
  assert.equal(await page.locator('.view-header > .sg-bookmark-ribbon').isVisible(),true);
  // Non-reading shelves keep a direct door to the Saved collection.
  await page.evaluate(async()=>{window.currentPath=null;await window.control.refresh()});
  assert.equal(await button.getAttribute('aria-label'),'Bookmarks');
  await button.tap();assert.equal(await page.evaluate(()=>window.saved),2);
  await page.evaluate(async()=>{window.currentPath='Alma 36.md';await window.control.refresh()});
  // Header indication continues to work when the dock is disabled.
  await page.evaluate(async()=>{window.control.unmountButton();document.querySelector('.sg-dock').remove();await window.control.refresh()});
  assert.equal(await page.locator('.sg-bookmark-ribbon').isVisible(),true);
  await page.evaluate(()=>window.control.dispose());assert.equal(await page.locator('.sg-bookmark-ribbon').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: bookmark ribbon and gold fill, add on tap, sheet (never remove) on gold tap, held tap, rapid taps, failure recovery, stale navigation, small phone/large text, hidden titles, dock disabled and cleanup.');
} finally {await browser.close()}
