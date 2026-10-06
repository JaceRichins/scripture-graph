import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = '../../../output/sidebar-navigation'; mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `import * as nav from './src/study/sidebarNavigation';import {Platform} from 'obsidian';window.sidebarNav={...nav,Platform};`, resolveDir: process.cwd() }, bundle: true, format: 'iife', outfile: out + '/navigation.js', plugins: [{ name: 'obsidian', setup(b) {
  b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock' }));
  b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const Platform={isMobile:true};export const setIcon=(el)=>{el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 3l9 8M6 9v12h12V9M10 21v-7h4v7"/></svg>'};` }));
} }] });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const drawer = side => `<div class="workspace-drawer mod-${side}${side==='right'?' is-collapsed':''}"><div class="workspace-drawer-inner"><div class="file-list" style="flex:1;overflow:auto;min-height:0;padding:20px">${side==='left'?'<p>The Record Speaks</p><p style="padding-left:20px">Review</p><p>Scripture Graph Home</p>':'<p>Ask Scripture Graph</p>'}${Array.from({length:60},(_,i)=>`<p>Folder ${i+1}</p>`).join('')}</div><div class="profile" style="padding:20px">Files<hr>Scripture graph</div></div></div>`;
  await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><body class="is-mobile mod-ios theme-dark sg-dock-on"><div class="workspace">${drawer('left')}${drawer('right')}</div><nav class="sg-dock sg-dock-sidebar-open">Hidden reading dock</nav></body>`);
  await page.addStyleTag({ path: '../../../output/timeline-preview/obsidian.css' });
  await page.addStyleTag({ path: 'styles.css' });
  await page.addStyleTag({ content: `body{--font-ui-medium:16px;--font-ui-small:16px;--safe-area-inset-top:47px;--safe-area-inset-bottom:24px;--mobile-sidebar-width:100vw;--mobile-sidebar-min-width:0;--mobile-sidebar-max-width:100vw;font:18px system-ui}.workspace-drawer.is-collapsed{display:none}` });
  await page.addScriptTag({ path: out + '/navigation.js' });
  await page.evaluate(() => {
    window.homeCalls=0;window.cleanups=[];window.events=[];
    const split=side=>({collapse(){document.querySelector('.mod-'+side).classList.add('is-collapsed')}});
    window.plugin={app:{workspace:{leftSplit:split('left'),rightSplit:split('right'),on:(_event,fn)=>{events.push(fn);return {}},onLayoutReady:fn=>fn()}},register:fn=>cleanups.push(fn),registerEvent:()=>{}};
    sidebarNav.registerSidebarNavigation(plugin,()=>homeCalls++);
  });
  await page.getByRole('button',{name:'Back to Home',exact:true}).waitFor();
  assert.equal(await page.locator('.sg-sidebar-return').count(),2);
  assert.equal(await page.locator('.sg-dock').isVisible(),false);
  const before=await page.getByRole('button',{name:'Back to Home',exact:true}).boundingBox();
  await page.locator('.mod-left .file-list').evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.equal((await page.getByRole('button',{name:'Back to Home',exact:true}).boundingBox()).y,before.y);
  await page.locator('.mod-left .file-list').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:out+'/phone-sidebar.png'});
  await page.getByRole('button',{name:'Back to Home',exact:true}).tap();
  assert.equal(await page.evaluate(()=>homeCalls),1);
  assert.equal(await page.locator('.workspace-drawer:not(.is-collapsed)').count(),0);
  await page.evaluate(()=>document.querySelector('.mod-right').classList.remove('is-collapsed'));
  await page.getByRole('button',{name:'Close sidebar and return to reading'}).tap();
  assert.equal(await page.evaluate(()=>homeCalls),1);
  assert.equal(await page.locator('.workspace-drawer:not(.is-collapsed)').count(),0);
  await page.evaluate(()=>{const inner=document.querySelector('.mod-left .workspace-drawer-inner');const replacement=inner.cloneNode(true);replacement.querySelector('.sg-sidebar-return').remove();inner.replaceWith(replacement);document.querySelector('.mod-left').classList.remove('is-collapsed')});
  await page.waitForFunction(()=>document.querySelectorAll('.sg-sidebar-return').length===2);
  await page.setViewportSize({width:320,height:700});
  await page.addStyleTag({content:'body{--font-ui-medium:22px}'});
  for(const selector of ['.mod-left .sg-sidebar-home','.mod-left .sg-sidebar-close']) {
    const box=await page.locator(selector).boundingBox(); assert.ok(box.height>=44); assert.ok(box.x>=0 && box.x+box.width<=320);
  }
  await page.setViewportSize({width:844,height:390});
  assert.equal(await page.getByRole('button',{name:'Back to Home',exact:true}).isVisible(),true);
  await page.evaluate(()=>{cleanups.forEach(fn=>fn());events.forEach(fn=>fn())});
  await page.waitForTimeout(50);
  assert.equal(await page.locator('.sg-sidebar-return').count(),0);
  await page.evaluate(()=>{sidebarNav.Platform.isMobile=false;sidebarNav.registerSidebarNavigation(plugin,()=>homeCalls++)});
  assert.equal(await page.locator('.sg-sidebar-return').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: both restored sidebars have visible exits with dock hidden; Home closes both then navigates; Close preserves reading; scrolling, rebuilds, large text, small phone, landscape, cleanup, and desktop all checked.');
} finally { await browser.close(); }
