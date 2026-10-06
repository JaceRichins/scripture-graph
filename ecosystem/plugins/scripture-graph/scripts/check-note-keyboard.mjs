import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('../../../output/note-keyboard');mkdirSync(out,{recursive:true});
const stub=`export const Platform={get isMobile(){return window.mobile!==false}};export class Menu{};export class Notice{};export class TFile{};
export class Modal {constructor(app){this.app=app;this.containerEl=document.body.createDiv({cls:'modal-container'});this.containerEl.createDiv({cls:'modal-bg'});this.modalEl=this.containerEl.createDiv({cls:'modal'});const close=this.modalEl.createDiv({cls:'modal-close-button',text:'×'});close.onclick=()=>this.close();this.contentEl=this.modalEl.createDiv({cls:'modal-content'});window.modal=this}open(){this.onOpen()}close(){this.onClose();this.containerEl.remove()}}`;
await build({stdin:{contents:`import {NoteModal} from './src/social/annotations';window.openNote=()=>new NoteModal({app:{}},'Alma 36:18',text=>{window.saved.push(text)}).open();`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:path.join(out,'note.js'),plugins:[{name:'boundaries',setup(b){
 b.onResolve({filter:/^(obsidian|.*identity|.*state|.*themeLibrary|.*connect)$/},a=>({path:a.path,namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='obsidian'?stub:'export const refreshIdentity=()=>{};export const CANONICAL_PREFIX="Canonical/";export const themeRibbons=()=>[];export const themeSpec=()=>({});export const themeWash=()=>"";export const connectionOf=()=>null;export const isConnectionNote=()=>false;'}));
}}]});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile is-phone"></body>');
 await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
 await page.addStyleTag({content:':root{--safe-area-inset-top:47px;--safe-area-inset-bottom:34px}body{font-family:Arial;background:#17272d}#keyboard{position:fixed;bottom:0;left:0;right:0;height:330px;background:#353638;z-index:99999;color:#ddd;padding:25px;text-align:center;box-sizing:border-box}'});
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
  HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.addClass=function(...c){this.classList.add(...c)};HTMLElement.prototype.empty=function(){this.replaceChildren()};
  window.saved=[];window.vv=Object.assign(new EventTarget(),{height:844,offsetTop:0});Object.defineProperty(window,'visualViewport',{value:window.vv});
  window.keyboard=(height,visualHeight=844,offset=0)=>{document.documentElement.style.setProperty('--keyboard-height',height+'px');window.vv.height=visualHeight;window.vv.offsetTop=offset;window.vv.dispatchEvent(new Event('resize'))};
 });
 await page.addScriptTag({path:path.join(out,'note.js')});await page.evaluate(()=>window.openNote());
 const note='My thoughts about this verse.\n'.repeat(35)+'The last sentence stays in my note.';
 await page.getByRole('textbox',{name:'Note on Alma 36:18'}).fill(note);
 await page.evaluate(()=>{window.keyboard(330);const keyboard=document.body.createDiv({text:'Simulated keyboard area',attr:{id:'keyboard'}})});
 const fits=async(bottom)=>{await page.waitForTimeout(60);const box=await page.getByRole('button',{name:'Save',exact:true}).boundingBox();assert.ok(box.y+box.height<=bottom,JSON.stringify(box));assert.ok(box.height>=44);assert.ok(await page.getByRole('button',{name:'Save',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}));};
 await fits(514);
 await page.getByRole('textbox').evaluate(el=>{el.scrollTop=el.scrollHeight});await fits(514);
 await page.evaluate(()=>window.keyboard(330,514));await fits(514);
 await page.evaluate(()=>{for(const key of ['--font-text-size','--font-ui-medium','--font-ui-large'])document.body.style.setProperty(key,'24px')});await fits(514);
 assert.equal(await page.getByRole('textbox').inputValue(),note);
 await page.screenshot({path:path.join(out,'save-above-keyboard.png')});
 await page.getByRole('button',{name:'Save',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.saved),[note]);assert.equal(await page.locator('.sg-note-modal').count(),0);
 assert.equal(await page.evaluate(()=>window.modal.modalEl.style.getPropertyValue('--sg-modal-height')),'');
 // Reopen and exercise browser-only keyboard resizing and panning.
 await page.evaluate(()=>{document.querySelector('#keyboard').remove();window.keyboard(0);window.openNote()});
 await page.getByRole('textbox').fill('Another note');await page.evaluate(()=>window.keyboard(0,410,30));await fits(440);
 await page.evaluate(()=>window.keyboard(0));await fits(810);
 await page.locator('.modal-close-button').click();assert.equal(await page.evaluate(()=>window.saved.length),1);
 // Closing before delayed focus must not reopen the keyboard or retain listeners.
 await page.evaluate(()=>{window.openNote();window.modal.close()});await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BODY');
 await page.setViewportSize({width:1100,height:850});await page.evaluate(()=>{window.mobile=false;document.body.className='theme-dark';window.openNote()});assert.equal(await page.locator('.sg-mobile-modal').count(),0);
 console.log('Note keyboard checks passed: long text, 24px text, Save hit-testing above keyboard, native/browser/both viewport signals, scroll and resize preserve text, submit exactly once, dismiss/close cleanup, and desktop sizing.');
}finally{await browser.close()}
