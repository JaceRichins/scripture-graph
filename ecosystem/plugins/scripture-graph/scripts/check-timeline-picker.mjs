import { build } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('../../../output/timeline-picker');mkdirSync(out,{recursive:true});
const obsidian=`export const Platform={get isMobile(){return window.mobile!==false}};export class ItemView{};export class Menu{};export class TFile{};
export class Modal {constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.containerEl.createDiv({cls:'modal-bg'});this.modalEl=this.containerEl.createDiv({cls:'modal'});const close=this.modalEl.createDiv({cls:'modal-close-button',text:'×'});close.onclick=()=>this.close();this.contentEl=this.modalEl.createDiv({cls:'modal-content'});window.modal=this}open(){this.onOpen()}close(){this.onClose();this.containerEl.remove()}}`;
await build({stdin:{contents:`import {openTimelinePicker,TimelineView} from './src/study/timelineView';import {prepareTimelineSubjects} from './src/study/timelineSubjects';import {TimelineWorld} from './src/study/timelineWorld';import {TFile} from 'obsidian';window.timelineTools={TimelineView,prepareTimelineSubjects,TimelineWorld};window.openPicker=()=>openTimelinePicker({app:{vault:{getAbstractFileByPath:()=>new TFile(),cachedRead:async()=> '\u0060\u0060\u0060json\\n'+JSON.stringify(window.timelineFixture??{book_years:{},events:Array.from({length:100},(_,i)=>({id:'e'+i,t:'Event '+i,y0:i,y1:i,lane:'ow',cat:['journeys'],people:['Person '+String(i).padStart(3,'0')]}))})+'\\n\u0060\u0060\u0060'}}},[],value=>window.saved=value);`,resolveDir:process.cwd()},bundle:true,format:'iife',loader:{'.jpg':'dataurl'},outfile:path.join(out,'picker.js'),plugins:[{name:'boundary',setup(b){b.onResolve({filter:/^(obsidian|.*vaultSync)$/},a=>({path:a.path,namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='obsidian'?obsidian:'export const lazyFetch=async()=>false;'}))}}]});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile is-phone"></body>');
 await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
 await page.addStyleTag({content:'body{font-family:Arial;background:#112430}:root{--safe-area-inset-top:47px;--safe-area-inset-bottom:24px}'});
 await page.evaluate(()=>{
   HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
   HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
   HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.addClass=function(...c){this.classList.add(...c)};HTMLElement.prototype.removeClass=function(...c){this.classList.remove(...c)};HTMLElement.prototype.toggleClass=function(c,on){this.classList.toggle(c,on)};HTMLElement.prototype.setAttr=function(k,v){this.setAttribute(k,v)};HTMLElement.prototype.setText=function(t){this.textContent=t};
   window.vv=Object.assign(new EventTarget(),{height:844,offsetTop:0});Object.defineProperty(window,'visualViewport',{value:window.vv});
   window.keyboard=(height,visualHeight=844,offset=0)=>{document.documentElement.style.setProperty('--keyboard-height',height+'px');window.vv.height=visualHeight;window.vv.offsetTop=offset;window.vv.dispatchEvent(new Event('resize'))};
 });
 await page.addScriptTag({path:path.join(out,'picker.js')});await page.evaluate(()=>window.openPicker());
 await page.locator('.sg-tlp-row').last().waitFor();await page.getByRole('combobox',{name:'Subject category'}).selectOption('people');assert.equal(await page.locator('.sg-tlp-row').count(),100);
 const geometry=()=>page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};return {modal:box('.sg-tlp-modal'),search:box('.sg-nav-filter'),list:box('.sg-tlp-list'),save:box('.sg-tlp-save'),name:box('.sg-tlp-name'),close:box('.modal-close-button'),width:document.body.scrollWidth}});
 const fits=async(bottom)=>{await page.waitForTimeout(60);const r=await geometry();assert.ok(r.modal.bottom<=bottom,JSON.stringify(r));assert.ok(r.save.bottom<=r.modal.bottom && r.name.bottom<=r.modal.bottom,JSON.stringify(r));assert.ok(r.search.top>=r.modal.top && r.close.top>=r.modal.top);assert.ok(r.list.height>=48);assert.ok(r.width<=390);return r};
 await fits(820);
 await page.getByRole('searchbox').focus();await page.evaluate(()=>window.keyboard(330));await fits(514);
 // Last option remains reachable without scrolling the name/Save controls away.
 await page.locator('.sg-tlp-list').evaluate(el=>el.scrollTop=el.scrollHeight);
 await page.getByText('Person 099',{exact:true}).click();assert.equal(await page.locator('.sg-tlp-chip').count(),1);await fits(514);
 assert.ok(await page.locator('.sg-tlp-list').evaluate(el=>el.scrollTop>1000),'selecting a subject must retain the list position');
 await page.screenshot({path:path.join(out,'keyboard-native-phone.png')});
 await page.getByRole('searchbox').fill('Person 042');assert.equal(await page.locator('.sg-tlp-row').count(),1);await page.getByText('Person 042',{exact:true}).click();
 await page.getByRole('textbox',{name:'Timeline name'}).fill('Two lives');
 // Both signals reported together must not subtract the keyboard twice.
 await page.evaluate(()=>window.keyboard(330,514));const both=await fits(514);assert.ok(both.modal.height>400);
 // Browser-only resizing and viewport panning are handled too.
 await page.evaluate(()=>window.keyboard(0,460,35));await fits(495);
 await page.evaluate(()=>{document.body.style.fontSize='22px';for(const name of ['--font-ui-medium','--font-ui-small','--font-text-size'])document.body.style.setProperty(name,'22px');window.keyboard(330)});await fits(514);
 await page.screenshot({path:path.join(out,'keyboard-larger-text.png')});
 await page.getByRole('button',{name:'Save',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.saved),{name:'Two lives',subjects:[{kind:'people',name:'Person 099'},{kind:'people',name:'Person 042'}]});
 await page.evaluate(()=>window.keyboard(0));assert.equal(await page.evaluate(()=>window.modal.modalEl.style.getPropertyValue('--sg-modal-height')),'');
 await page.evaluate(()=>{document.body.style.fontSize='';for(const name of ['--font-ui-medium','--font-ui-small','--font-text-size'])document.body.style.removeProperty(name);window.openPicker()});await fits(820);
 await page.evaluate(()=>window.keyboard(330));await fits(514);await page.evaluate(()=>window.keyboard(0));const restored=await fits(820);assert.ok(restored.modal.height>650);
 await page.locator('.modal-close-button').click();assert.equal(await page.locator('.sg-tlp-modal').count(),0);
 await page.setViewportSize({width:1100,height:850});await page.evaluate(()=>{window.mobile=false;document.body.className='theme-dark';window.openPicker()});assert.equal(await page.locator('.sg-tlp-mobile').count(),0);
 await page.locator('.modal-close-button').click();
 const data=JSON.parse(readFileSync('../../../output/timeline-categories/data.json','utf8'));
 for(const width of [390,768]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(data=>{window.mobile=true;document.body.className='theme-dark is-mobile is-phone';window.timelineFixture=data;window.keyboard(0);window.openPicker()},data);
   const category=page.getByRole('combobox',{name:'Subject category'});
   await category.locator('option[value=topics]').waitFor({state:'attached'});
   assert.deepEqual(await category.locator('option').evaluateAll(options=>options.map(o=>o.value)),['all','people','places','events','topics','things','books','storylines','categories','sources']);
   await page.screenshot({path:path.join(out,`categories-${width}.png`)});
   await category.selectOption('topics');await page.getByRole('searchbox').fill('Baptism');
   await page.locator('.sg-tlp-row').filter({has:page.locator('.sg-nav-name',{hasText:/^Baptism$/})}).click();
   assert.equal(await page.locator('.sg-tlp-row').first().evaluate(el=>getComputedStyle(el).animationName),'none','search results must not disappear during a selection animation');
   await page.screenshot({path:path.join(out,`topics-${width}.png`)});
   await category.selectOption('sources');await page.getByRole('searchbox').fill('Phelps');
   assert.equal(await page.locator('.sg-tlp-row').count(),1);await page.locator('.sg-tlp-row').click();
   await category.selectOption('events');await page.getByRole('searchbox').fill('The Kirtland Temple; keys restored');
   assert.equal(await page.locator('.sg-tlp-row').count(),1);await page.locator('.sg-tlp-row').click();
   await category.selectOption('storylines');await page.getByRole('searchbox').fill('Jaredites');await page.locator('.sg-tlp-row').click();
   await category.selectOption('categories');await page.getByRole('searchbox').fill('Temples');await page.locator('.sg-tlp-row').click();
   await category.selectOption('books');await page.getByRole('searchbox').fill('Doctrine and Covenants');await page.locator('.sg-tlp-row').click();
   assert.equal(await page.locator('.sg-tlp-chip').count(),6);
   assert.ok(await page.locator('.sg-tlp-modal').evaluate(el=>el.scrollWidth<=el.clientWidth));
   await page.getByRole('textbox',{name:'Timeline name'}).fill('Baptism and Kirtland');
   await page.getByRole('button',{name:'Save',exact:true}).click();
   const result=await page.evaluate(()=>{
     const {TimelineView,prepareTimelineSubjects,TimelineWorld}=window.timelineTools;
     window.studyView=new TimelineView({}, {app:{workspace:{openLinkText:async path=>window.opened.push(path)}}});window.opened=[];
     window.studyView.data=prepareTimelineSubjects(window.timelineFixture);window.studyView.render=()=>{};
     window.studyView.applyPreset({title:window.saved.name,subjects:JSON.parse(JSON.stringify(window.saved.subjects))});
     const visible=window.studyView.visible();
     window.canvasHost=document.body.createDiv();window.canvasHost.style.height='700px';
     window.timelineWorld=new TimelineWorld(window.canvasHost,visible,window.studyView.data,window.saved.subjects,()=>{});
     return{saved:window.saved,ids:visible.map(e=>e.id),columns:[...document.querySelectorAll('.sg-tw-column')].map(e=>e.textContent)};
   });
   assert.deepEqual(result.saved.subjects.map(s=>s.kind),['topics','sources','events','storylines','categories','books']);
   assert.equal(result.columns.length,6);assert.ok(result.ids.includes('kirtland-temple'));
   assert.ok(result.ids.includes('alma-waters')||data.events.some(e=>result.ids.includes(e.id)&&e.t==='Alma baptizes at the waters of Mormon'));
   await page.evaluate(()=>{window.timelineWorld.destroy();window.canvasHost.remove();window.studyView.focuses=[{kind:'topics',name:'Baptism'}];window.cards=document.body.createDiv({cls:'sg-tl-stream'});window.studyView.renderCards(window.cards)});
   await page.locator('.sg-tl-source-connections summary').first().click();
   const evidence=page.locator('.sg-tl-source-row').filter({has:page.getByRole('button',{name:'Baptism',exact:true})}).first();
   await evidence.getByRole('button',{name:'Baptism',exact:true}).click();
   assert.equal(await page.evaluate(()=>window.opened[0]),'AI Library/02 Gospel Topics/Baptism.md');
   assert.ok((await evidence.innerText()).includes('context link'));
   await page.screenshot({path:path.join(out,`topic-evidence-${width}.png`)});
   await page.evaluate(()=>window.cards.remove());
 }
 console.log('Timeline picker passed: keyboard geometry, large text, category browsing, real vault topics/documents/events/books/storylines/event types at 390px and 768px, mixed saving and reopening, canvas columns, source links, and desktop sizing.');
}finally{await browser.close()}
