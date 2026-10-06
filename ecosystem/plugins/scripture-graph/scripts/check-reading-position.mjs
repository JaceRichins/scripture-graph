import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/reading-position'); mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `import * as positions from './src/study/readingPosition'; import * as nav from './src/study/leafNav'; window.api={...positions,...nav};`, resolveDir:process.cwd() }, bundle:true,format:'iife',outfile:path.join(out,'test.js') });
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}main{height:700px;overflow:auto}p{margin:0;height:100px}</style><main></main>');
  await page.addScriptTag({path:path.join(out,'test.js')});
  await page.evaluate(()=>{
    const root=document.querySelector('main');
    window.fill=prefix=>{root.innerHTML=Array.from({length:40},(_,i)=>`<p>${prefix} paragraph ${i}</p>`).join('')};
    window.view=window.api.rememberReadingPosition({
      contentEl:root, state:'A', getViewType(){return 'custom'},
      getEphemeralState(){return {nativeField:'preserved'}},setEphemeralState(s){window.nativeReceived=s.nativeField},
      async setState(state){this.state=state;root.replaceChildren();await new Promise(r=>setTimeout(r,100));window.fill(state)},onClose(){window.pageClosed=true},
    });
    window.leaf={view:window.view,getViewState:()=>({page:window.view.state}),getHistoryState:()=>({state:window.view.state,eState:{hostField:true}})};
    const snapshot=()=>({state:window.view.state,eState:window.view.getEphemeralState()});
    const restore=entry=>{window.view.setState(entry.state);window.view.setEphemeralState(entry.eState)};
    window.leaf.history={backHistory:[],forwardHistory:[],pushState(entry){this.backHistory.push(entry);this.forwardHistory=[]},back(){this.forwardHistory.push(snapshot());restore(this.backHistory.pop())},forward(){this.backHistory.push(snapshot());restore(this.forwardHistory.pop())}};
    window.fill('A');root.scrollTop=950;
    window.api.recordHistory(window.leaf);
  });
  const saved=await page.evaluate(()=>window.leaf.history.backHistory[0]);
  assert.equal(saved.eState.sgReadingPosition.top,950);assert.equal(saved.eState.hostField,true);assert.equal(saved.eState.nativeField,'preserved');
  await page.evaluate(async()=>{await window.view.setState('B');window.view.contentEl.scrollTop=430;window.api.historyBack(window.leaf)});
  await page.waitForFunction(()=>window.view.state==='A' && Math.abs(window.view.contentEl.scrollTop-950)<1);
  assert.equal(await page.evaluate(()=>window.nativeReceived),'preserved');
  await page.evaluate(()=>window.api.historyForward(window.leaf));
  await page.waitForFunction(()=>window.view.state==='B' && Math.abs(window.view.contentEl.scrollTop-430)<1);
  // A late paragraph above the saved anchor keeps the same passage at the same offset.
  await page.evaluate(()=>{const p=document.createElement('p');p.textContent='Late image placeholder';window.view.contentEl.prepend(p)});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===530);
  // Reader interaction ends restoration: content arriving later must not snap them back.
  await page.evaluate(()=>{const root=window.view.contentEl;root.dispatchEvent(new Event('touchstart'));root.scrollTop=160;const p=document.createElement('p');p.textContent='More late content';root.prepend(p)});
  await page.waitForTimeout(150);
  // Disable browser scroll anchoring for explicit cancellation checks.
  await page.addStyleTag({content:'main{overflow-anchor:none}'});
  await page.evaluate(()=>{const root=window.view.contentEl;root.scrollTop=160;root.append(document.createElement('p'))});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),160);
  // A subsequent navigation cancels an earlier pending restore.
  await page.evaluate(async()=>{window.view.setEphemeralState({sgReadingPosition:{top:900,left:0}});await window.view.setState('C')});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),0);
  await page.evaluate(()=>{window.view.setEphemeralState({sgReadingPosition:{top:900,left:0}});window.view.onClose()});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),0);assert.equal(await page.evaluate(()=>window.pageClosed),true);
  // Invalid state is harmless; the legacy history fallback also captures the page offset.
  await page.evaluate(()=>{window.view.setEphemeralState({sgReadingPosition:{top:NaN,left:0}});window.view.contentEl.scrollTop=220;delete window.leaf.getHistoryState;delete window.leaf.history.pushState;window.api.recordHistory(window.leaf)});
  assert.equal(await page.evaluate(()=>window.leaf.history.backHistory.at(-1).eState.sgReadingPosition.top),220);
  console.log('Reading position: Back/Forward, independent pages, delayed rendering, anchor reflow, touch cancellation, navigation/close cleanup, native fields, invalid state, and legacy history passed at iPhone viewport.');
} finally {await browser.close()}
