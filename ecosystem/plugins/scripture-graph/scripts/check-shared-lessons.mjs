import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/shared-lessons'); mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `import * as shared from './src/social/sharedLessons';window.shared=shared;`, resolveDir: process.cwd() }, bundle: true, format: 'iife', outfile: path.join(out, 'ui.js'), plugins: [{ name: 'obsidian-fixture', setup(b) {
  b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export class ItemView {constructor(){this.contentEl=document.createElement('div');document.body.append(this.contentEl)}async setState(){}registerDomEvent(){}}export class Modal{}export class Notice{}` }));
} }] });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width:390,height:844 }, isMobile:true,hasTouch:true });
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile"><div id="work"></div></body>');
  await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});
  await page.addStyleTag({path:'styles.css'});
  await page.addScriptTag({path:path.join(out,'ui.js')});
  await page.evaluate(async()=>{
    HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;if(o.value)e.value=o.value;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
    HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
    HTMLElement.prototype.addClass=function(...names){this.classList.add(...names)};HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.isShown=function(){return this.isConnected};
    window.saved={id:'one',title:'Restored Priesthood and Our Quorum',owner_name:'Brett Richins',recipient_name:'Jace',updated_at:'2026-09-13T02:16:38Z',markdown:'# Our quorum\n\n**Aim:** Help someone come closer to Jesus Christ.\n\n## Discuss together\n\n- What blessing do you notice in [[D&C 13]]?\n\n## This week\n\nChoose one way to serve.',read_only:true};
    window.state = {
      signedIn: true,
      api: { sharedLesson: async () => { if (window.denied) throw Error('revoked'); return {...window.saved}; }, sharedLessons: async () => ({incoming:[window.saved],outgoing:[]}) },
      app: { workspace: { getLeaf: () => ({ setViewState: async (s) => { window.opened=s; } }) } },
    };
    await window.shared.sharedLessonsSection(document.querySelector('#work'),window.state);
  });
  await page.getByRole('button',{name:/Restored Priesthood/}).click();
  assert.equal(await page.evaluate(()=>window.opened.state.id),'one');
  await page.evaluate(async()=>{document.querySelector('#work').remove();window.view=new window.shared.SharedLessonView({},window.state,()=>{window.wentBack=true});await window.view.onOpen();await window.view.setState({id:'one'},{});});
  await page.getByText(/Last saved/).waitFor();
  assert.equal(await page.locator('textarea,[contenteditable=true]').count(),0);
  assert.equal(await page.locator('.sg-shared-body a').count(),0);
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=window.innerWidth));
  await page.screenshot({path:path.join(out,'phone.png'),fullPage:true});
  await page.evaluate(()=>{window.saved.markdown='# Revised plan\n\nLATEST_SAVED_EDIT\n\n<script>window.executed=true</script>\n\n![[private.md]]\n\n```dataviewjs\nwindow.executed=true\n```';});
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByText('LATEST_SAVED_EDIT').waitFor();
  assert.equal(await page.evaluate(()=>window.executed),undefined);
  assert.equal(await page.locator('.sg-shared-body script,.sg-shared-body img,.sg-shared-body iframe').count(),0);
  await page.evaluate(()=>{window.denied=true;});await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByText(/This lesson is unavailable/).waitFor();
  assert.equal(await page.getByText('LATEST_SAVED_EDIT').count(),0);
  await page.getByRole('button',{name:'‹ My Work'}).click();assert.equal(await page.evaluate(()=>window.wentBack),true);
  await page.evaluate(async()=>{await window.view.onClose();});
  console.log('Shared lesson UI: incoming entry, read-only page, saved updates, inert source markup, revocation, phone width and return navigation passed.');
} finally { await browser.close(); }
