import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/photo-gallery'); mkdirSync(out, { recursive: true });
const names = [...readFileSync('src/study/scenes.ts','utf8').matchAll(/\{ id: ["']([^"']+)["'], name: ["']([^"']+)["']/g)].map(m => ({id:m[1],name:m[2]}));
await build({ stdin: { contents: `import * as gallery from './src/study/photoGallery';import {PHOTO_THUMBNAILS} from './src/study/photoThumbnails';import {EventBackgroundPreview} from './src/study/eventBackgroundPreview';window.gallery=gallery;window.thumbs=PHOTO_THUMBNAILS;window.Preview=EventBackgroundPreview;`, resolveDir: process.cwd() },
  bundle: true, format: 'iife', loader: {'.jpg':'dataurl'}, outfile: path.join(out,'gallery.js'), plugins: [{name:'obsidian-preview',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export class Modal { constructor() { this.modalEl=document.createElement('div');this.modalEl.className='modal';this.contentEl=this.modalEl.createDiv(); } open(){document.body.append(this.modalEl);const b=this.modalEl.createEl('button',{text:'Close preview'});b.onclick=()=>this.close();this.onOpen();} close(){this.onClose();this.modalEl.remove();} }` }));}}] });
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark"><main><button id="back">‹ Photos</button><h1>Photos</h1><div id="content"></div></main></body>');
  await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});
  await page.addStyleTag({path:'styles.css'});
  await page.addStyleTag({content:'html,body{height:100%;overflow:hidden!important;background:#112029}body{display:block;color:#f0f1ee;font:16px/1.5 Arial}main{position:fixed;inset:0;overflow:auto;max-width:1080px;margin:auto;padding:22px 18px;box-sizing:border-box}h1{font:36px Georgia;color:#faf8f2}button{cursor:pointer}.modal{position:fixed;inset:5vh 3vw;overflow:auto;background:#182630;z-index:1000;padding:24px;box-sizing:border-box}'});
  await page.evaluate(()=>{
    HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
    HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
    HTMLElement.prototype.addClass=function(c){this.classList.add(c)};HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.setText=function(t){this.textContent=t};
  });
  await page.addScriptTag({path:path.join(out,'gallery.js')});
  await page.evaluate(names=>{
    window.rows=window.gallery.photoLibrary(names);window.state={};window.requested=0;
    window.io={thumbnail:id=>window.thumbs[id],select:id=>{const row=window.rows.find(r=>r.id===id);document.querySelector('h1').textContent=row.name;const c=document.querySelector('#content');c.empty();window.gallery.renderPhotoDetail(c,row,{},window.io);window.scrollTo(0,0)},open:title=>{window.opened=title},preview:row=>new window.Preview({}, {scene:row.id,name:'Artistic reading background',chapter:row.name,slug:'',volume:''},async(id,wide)=>{window.requested++;return window.thumbs[id]}).open()};
    window.show=()=>{document.querySelector('h1').textContent='Photos';const c=document.querySelector('#content');c.empty();window.gallery.renderPhotoGallery(c,window.rows,window.state,window.io)};document.querySelector('#back').onclick=window.show;window.show();
  },names);
  assert.equal(await page.locator('.sg-photo-card').count(),12);
  assert.equal(await page.evaluate(()=>window.requested),0);
  await page.locator('.sg-photo-card img').evaluateAll(imgs=>Promise.all(imgs.map(img=>{img.loading='eager';return img.decode()})));
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=390));
  await page.screenshot({path:path.join(out,'photos-phone.png')});
  await page.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await page.locator('.sg-photo-card').count(),12);
  const search=page.getByRole('searchbox');await search.fill('john 5');
  assert.equal(await page.evaluate(()=>document.activeElement?.tagName),'INPUT');
  await page.getByRole('button',{name:/^Pool of Bethesda,/}).click();
  assert.equal(await page.locator('h1').textContent(),'Pool of Bethesda');
  await page.getByRole('button',{name:'John 5',exact:true}).click();assert.equal(await page.evaluate(()=>window.opened),'John 5');
  await page.evaluate(()=>{document.querySelector('main').scrollTop=0});
  await page.screenshot({path:path.join(out,'photo-detail-phone.png')});
  await page.getByRole('button',{name:'Open full photo: Pool of Bethesda'}).click();
  await page.locator('.sg-event-preview-stage img').waitFor();assert.equal(await page.evaluate(()=>window.requested),1);
  await page.getByRole('button',{name:'Close preview'}).click();assert.equal(await page.locator('.modal').count(),0);
  await page.getByRole('button',{name:'‹ Photos',exact:true}).click();assert.equal(await search.inputValue(),'john 5');
  await search.fill('nothing matches this');assert.equal(await page.locator('.sg-photo-card').count(),0);
  await search.fill('');await page.getByRole('combobox').selectOption('Book of Mormon');assert.ok(await page.locator('.sg-photo-card').count()>0);
  await page.getByRole('combobox').selectOption('');
  // Browse every page: each of the 95 scenes appears exactly once.
  const seen=[];
  while(true){seen.push(...await page.locator('.sg-photo-name').allTextContents());const next=page.getByRole('button',{name:'Next',exact:true});if(await next.isDisabled())break;await next.click();}
  assert.equal(seen.length,95);assert.equal(new Set(seen).size,95);
  await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>{window.state={};window.show();document.querySelector('main').scrollTop=0});
  await page.screenshot({path:path.join(out,'photos-desktop.png')});
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=1280));
  assert.deepEqual(errors,[]);
  console.log('Photos UI passed: 95 distinct cards, 12/page, no gallery downloads, exact chapter search, collections, full preview, chapter links, preserved Back filters, no horizontal overflow on phone or desktop.');
} finally { await browser.close(); }
