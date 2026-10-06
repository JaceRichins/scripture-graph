import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source = readFileSync('src/ai/askView.ts', 'utf8');
const context = vm.createContext({ exports: {}, require: () => ({ ItemView: class {} }) });
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const render = context.exports.AskView.prototype.renderModes.toString();
mkdirSync('../../../output/ai-modes', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile"><section class="sg-ai-workspace sg-overlay-chat"><main class="sg-ask" style="height:100dvh"><div class="sg-ask-header"><button>My work</button><div class="sg-ai-modes sg-ask-title"></div><button>More</button><button>Done</button></div><div class="sg-ask-log"><div class="sg-turn sg-turn-assistant">What would you like to study?</div></div><div class="sg-ask-input"><textarea placeholder="Ask or create anything…"></textarea><button class="sg-ai-send">↑</button></div></main></section></body>');
  await page.addStyleTag({ path: '../../../output/timeline-preview/obsidian.css' });
  await page.addStyleTag({ path: 'styles.css' });
  await page.evaluate(render => {
    HTMLElement.prototype.createEl = function(tag, o = {}) { const e = document.createElement(tag); if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e; };
    HTMLElement.prototype.createDiv = function(o) { return this.createEl('div', o); };
    HTMLElement.prototype.empty = function() { this.replaceChildren(); };
    window.obsidian_1 = { Menu: class {
      constructor() { this.items=[]; }
      addItem(fn) { const item={setTitle(v){this.title=v;return this},setChecked(v){this.checked=v;return this},setDisabled(v){this.disabled=v;return this},onClick(fn){this.click=fn;return this}};fn(item);this.items.push(item);return this; }
      addSeparator() { return this; }
      showAtMouseEvent() { window.lastMenu=this; }
    }};
    window.view = { modesEl: document.querySelector('.sg-ai-modes'), mode:'chat', busy:false, showingPage:false, researchAllowance:{remaining:3,limit:3,period:'week'},studyPlanAllowance:{remaining:2,limit:2,period:'week'}, refreshResearchAllowance:async()=>{} };
    window.view.renderModes = new Function('return function ' + render)(); window.view.renderModes();
  }, render);
  assert.equal(await page.locator('.sg-ask-header .sg-ai-mode-trigger').count(),1);
  await page.getByRole('button', { name:'Assistant mode: Chat', exact:true }).click();
  assert.equal(await page.evaluate(()=>window.lastMenu.items.filter(i=>i.checked)[0].title),'Chat');
  await page.evaluate(()=>window.lastMenu.items.find(i=>i.title.startsWith('Research')).click());
  assert.equal(await page.evaluate(()=>window.view.mode), 'research');
  await page.getByRole('button',{name:'Assistant mode: Research',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.lastMenu.items[1].title),'Research · 3 of 3 left this week');
  assert.equal(await page.evaluate(()=>window.lastMenu.items[3].title),'Create study plan · 2 of 2 left this week');
  await page.evaluate(()=>window.lastMenu.items[3].click());
  await page.evaluate(()=>{window.view.studyPlanAllowance={unlimited:true};window.view.renderModes()});
  await page.getByRole('button',{name:'Assistant mode: Create study plan',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.lastMenu.items[3].title),'Create study plan · Unlimited');
  for(const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    for(const scale of [1,1.5]) {
      await page.evaluate(scale=>document.body.style.setProperty('--sg-read-scale',scale),scale);
      assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth), `No overflow at ${width}/${scale}`);
      assert.ok((await page.locator('.sg-ask-header').boundingBox()).height<=70, 'Mode selector uses only the existing header row');
      for(const button of await page.locator('.sg-ai-mode-trigger').all()) {
        const b=await button.boundingBox(); assert.ok(b.height>=44); assert.ok(b.x>=0 && b.x+b.width<=width);
      }
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.body.style.setProperty('--sg-read-scale','1'));
  await page.screenshot({path:'../../../output/ai-modes/research-phone.png'});
  await page.evaluate(()=>{window.view.busy=true;window.view.renderModes()});
  assert.equal(await page.locator('.sg-ai-mode-trigger:disabled').count(),1);
  await page.evaluate(()=>{window.view.busy=false;window.view.showingPage=true;window.view.renderModes()});
  assert.equal(await page.locator('.sg-ai-modes').isVisible(),false);
  console.log('AI mode dropdown: header placement, four choices, weekly/owner menu labels, busy lock, page hiding, compact 320/390/768 layouts and larger text passed.');
} finally { await browser.close(); }
