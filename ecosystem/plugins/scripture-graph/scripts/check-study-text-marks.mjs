import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('../../../output/study-text-marks');mkdirSync(out,{recursive:true});
const fixtures={
 obsidian:`export const Platform={isMobile:true};export class Notice{};export class Menu{};export class Setting{};export class TFile{};export class Modal{constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.modalEl=this.containerEl.createDiv({cls:'modal'});this.contentEl=this.modalEl.createDiv({cls:'modal-content'})}open(){this.onOpen()}close(){this.onClose();this.containerEl.remove()}}`,
 '../state':`export const CANONICAL_PREFIX='Canonical/';`,
 './identity':`export const refreshIdentity=()=>{};`,
 '../study/connect':`export const isConnectionNote=()=>false;export const connectionOf=()=>null;`,
 './connect':`export class ConnectModal{};export const isConnectionNote=()=>false;export const connectionOf=()=>null;`,
 './trace':`export const trace=()=>{};`,
 './translations':`export class TranslationsModal{};export const isBiblical=()=>false;`,
};
await build({stdin:{contents:`import {decorateStudyText,studyTextAnchor} from './src/social/studyTextAnnotations';import {AnnotationService,decorateVerse} from './src/social/annotations';import {StudyBar} from './src/study/studyBar';window.api={decorateStudyText,studyTextAnchor,AnnotationService,decorateVerse,StudyBar};`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:path.join(out,'marks.js'),plugins:[{name:'boundary',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(fixtures,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path]}))}}]});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.route('https://study.test/**',route=>route.fulfill({body:'<!doctype html><html></html>',contentType:'text/html'}));
 await page.goto('https://study.test/');
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile"><main class="markdown-preview-view"><h2>Alma 36 — Study Guide</h2><section id="guide"></section></main></body>');
 await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
 await page.addStyleTag({content:'body{display:block;font-family:Arial;background:#182b34;color:#eee}main{padding:22px;font-size:18px;line-height:1.6}.sg-studybar{z-index:100}.modal{position:fixed;z-index:200}'});
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
  HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};HTMLElement.prototype.addClass=function(...c){this.classList.add(...c)};HTMLElement.prototype.removeClass=function(...c){this.classList.remove(...c)};HTMLElement.prototype.toggleClass=function(c,on){this.classList.toggle(c,on)};HTMLElement.prototype.empty=function(){this.replaceChildren()};
  window.original='<p>The account connects <a href="#conversion">Conversion</a> with transformed conduct. Alma does not present relief as the endpoint: <strong>being born of God</strong> leads him to labor so others can repent.</p><p><strong>3 lessons</strong> worth remembering. Trust does not eliminate adversity.</p><p data-verse-id="alma-36-18"><strong>18</strong> Jesus, thou Son of God, have mercy on me.</p>';
  document.querySelector('#guide').innerHTML=window.original;
 });
 await page.addScriptTag({path:path.join(out,'marks.js')});
 await page.evaluate(async()=>{
  window.source='AI Library/01 Scriptures/Study Guides/03 Book of Mormon/09 Alma/Alma 36 - Study Guide.md';window.records=new Map();
  window.state={device:{userId:'me',lastColor:'yellow',lastStyle:'highlight',lastShareScope:{visibility:'private',groupId:null},showScopes:{mine:true,groups:{},public:false}},settings:{themes:[]},groups:[],socialCache:new Map(),saveDevice:async()=>{},app:{metadataCache:{getFileCache:()=>({frontmatter:{slug:'alma-36'}})},workspace:{getActiveFile:()=>({path:'My notes.md'})}},sync:{save:async a=>window.records.set(a.annotation_id,JSON.parse(JSON.stringify(a))),annotationsForAnchor:async anchor=>[...window.records.values()].filter(a=>a.anchor_id===anchor),softDelete:async id=>window.records.delete(id)},rerenderReading(){window.repaint=this.redecorate()}};
  window.ann=new window.api.AnnotationService(window.state);window.ann.scheduleSync=()=>{};
  window.bar=new window.api.StudyBar(window.state,window.ann,{},()=>{});
  await window.api.decorateStudyText(document.querySelector('#guide'),window.source,window.state,window.ann);
  window.selectText=(index,phrase)=>{const p=document.querySelectorAll('#guide p')[index];const nodes=[];const walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement.closest('.sgh-note-icon,.sg-badge'))nodes.push(n)}const text=nodes.map(n=>n.data).join('');const start=text.indexOf(phrase);if(start<0)throw Error('Missing phrase');const point=offset=>{for(const n of nodes){if(offset<=n.length)return[n,offset];offset-=n.length}};const [a,x]=point(start),[b,y]=point(start+phrase.length);const r=document.createRange();r.setStart(a,x);r.setEnd(b,y);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);window.bar.capturePartial(sel)};
 });
 assert.equal(await page.locator('[data-sg-study-block]').count(),2);assert.equal(await page.locator('[data-verse-id][data-sg-study-block]').count(),0);
 await page.evaluate(()=>window.selectText(0,'being born of God leads him to labor'));
 await page.getByRole('button',{name:'Mark yellow',exact:true}).waitFor();
 await page.screenshot({path:path.join(out,'selection-tools-phone.png')});
 await page.getByRole('button',{name:'Mark yellow',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#guide mark')?.textContent==='being born of God leads him to labor');
 assert.equal(await page.evaluate(()=>[...window.records.values()][0].visibility),'private');
 assert.ok((await page.evaluate(()=>[...window.records.values()][0].anchor_id)).startsWith('study:'));
 assert.equal(await page.locator('#guide a').count(),1);
 // Bold leading numbers in commentary must never turn it into scripture verse 3.
 await page.evaluate(()=>window.selectText(1,'3 lessons'));
 assert.ok((await page.evaluate(()=>window.bar.doc.anchor)).startsWith('study:'));
 await page.getByRole('button',{name:'Note',exact:true}).click();await page.getByRole('textbox').fill('My note on the study guide.');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#guide .sgh-note-icon').length===1);
 assert.equal(await page.evaluate(()=>[...window.records.values()].find(a=>a.annotation_type==='note').content),'> "3 lessons"\n\nMy note on the study guide.');
 // Reopening the embed/reader uses the same source paragraph anchor and marks.
 const before=await page.evaluate(()=>document.querySelector('#guide p').getAttribute('data-sg-doc-anchor'));
 await page.evaluate(async()=>{document.querySelector('#guide').innerHTML=window.original;await window.api.decorateStudyText(document.querySelector('#guide'),window.source,window.state,window.ann)});
 assert.equal(await page.locator('#guide mark').textContent(),'being born of God leads him to labor');assert.equal(await page.locator('#guide .sgh-note-icon').count(),1);
 assert.equal(await page.locator('#guide p').first().getAttribute('data-sg-doc-anchor'),before);
 await page.evaluate(()=>window.selectText(0,'being born of God leads him to labor'));await page.getByRole('button',{name:'Mark yellow',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#guide mark'));
 assert.equal(await page.evaluate(()=>window.records.size),1);
 const anchors=await page.evaluate(()=>[window.api.studyTextAnchor(window.source,'One paragraph'),window.api.studyTextAnchor(window.source,'One   paragraph'),window.api.studyTextAnchor('Other guide.md','One paragraph')]);assert.equal(anchors[0],anchors[1]);assert.notEqual(anchors[0],anchors[2]);
 console.log('Study text marks passed: embedded paragraphs, mixed bold/link selection, note quote + private anchor, numeric commentary stays non-scripture, in-place display, reopen persistence, mark removal, stable source identity, and mobile tools.');
}finally{await browser.close()}

