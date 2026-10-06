import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/print-check'); mkdirSync(out, { recursive: true });
const stub = `export const Platform={isMobile:true};
export class Component {load(){}unload(){}}
export class Notice {constructor(text){window.lastNotice=text}}
export class TFile {constructor(path){this.path=path;this.basename=path.split('/').pop().replace(/\\.md$/,'');this.extension='md';this.parent={path:path.slice(0,path.lastIndexOf('/'))}}}
export class Menu {items=[];addItem(fn){let entry={setTitle(t){this.title=t;return this},setIcon(){return this},onClick(fn){this.click=fn;return this}};fn(entry);this.items.push(entry);return this}}
export class Modal {constructor(app){this.app=app;this.containerEl=document.createElement('div');this.containerEl.className='modal-container';this.modalEl=document.createElement('div');this.modalEl.className='modal';this.titleEl=document.createElement('h2');this.contentEl=document.createElement('div');this.contentEl.className='modal-content';this.modalEl.append(this.titleEl,this.contentEl);this.containerEl.append(this.modalEl)}setTitle(t){this.titleEl.textContent=t}open(){document.body.append(this.containerEl);this.onOpen()}close(){this.onClose();this.containerEl.remove()}}
export const MarkdownRenderer={render:async(app,text,root)=>{window.renderedMarkdown=text;root.innerHTML=text.split(/\\n\\s*\\n/).map(p=>p.startsWith('<')?p:p.startsWith('# ')?'<h1>'+p.slice(2)+'</h1>':p.startsWith('## ')?'<h2>'+p.slice(3)+'</h2>':'<p>'+p+'</p>').join('')}};`;
await build({stdin:{contents:`import * as printing from './src/printing/printMenu';import * as content from './src/printing/printContent';import * as pdf from './src/printing/printPdf';import * as obsidian from 'obsidian';window.printing={...printing,...content,...pdf,...obsidian};`,resolveDir:process.cwd()},bundle:true,format:'iife',platform:'browser',outfile:path.join(out,'print.js'),plugins:[{name:'mock',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:stub}))}}]});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="is-mobile mod-ios theme-dark"><div class="sg-ai-workspace">AI workspace</div></body>');
 await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});
 await page.addStyleTag({path:'styles.css'});
 await page.addScriptTag({path:path.join(out,'print.js')});
 await page.evaluate(()=>{
  HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;if(o.type)e.type=o.type;if(o.value)e.value=o.value;for(const [k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
  HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
  HTMLElement.prototype.addClass=function(c){this.classList.add(c)};HTMLElement.prototype.setText=function(t){this.textContent=t};HTMLElement.prototype.empty=function(){this.replaceChildren()};
  const {PrintModal,Menu,TFile,addPrintItems,lessonPages,printMarkdown}=printing;
  const files=[new TFile('Library/Lessons/Learning/Learning.md'),new TFile('Library/Lessons/Learning/Preparation guide.md'),new TFile('Library/Lessons/Learning/Reference - James 1.md'),new TFile('Library/Lessons/Other/Private.md')];
  const main='# Learning together\n\nAudience: adults. Duration: 20 minutes.\n\n## Opening — 3 minutes\n\nWhat helps us listen carefully? Allow quiet reflection before inviting discussion.\n\n## Study — 12 minutes\n\nRead [[James 1#^james-1-5]]. Discuss how this passage can guide our choices.\n\n'+Array.from({length:24},(_,i)=>'## Discussion '+(i+1)+'\n\n'+('Listen with patience. Invite different perspectives. Ask what the text says and how it can help this week. ').repeat(6)).join('\n\n')+'\n\n## Closing — 5 minutes\n\nFINAL LESSON SENTENCE. Invite each participant to choose one small act of kindness.\n\n<table><tr><th>Time</th><th>Activity</th></tr><tr><td>5 minutes</td><td>Reflection</td></tr></table>';
  const texts=[main,'# Preparation guide\n\n## Before class\n\nRead the passages, prepare the room, and bring paper copies.\n\n## Five-minute alternative\n\nRead the main passage and choose two questions. FINAL PREPARATION SENTENCE.','Reference copy','PRIVATE OTHER PROJECT'];
  const app={vault:{getMarkdownFiles:()=>files,read:async f=>texts[files.indexOf(f)],getAbstractFileByPath:path=>path === 'Library/Printouts' ? {} : null,createBinary:async(path,bytes)=>{window.savedPdf={path,length:bytes.byteLength};return {path}}},metadataCache:{getFileCache:f=>({frontmatter:{content_type:f.basename.startsWith('Reference')?'reference-copy':'lesson',lesson_order:files.indexOf(f)}})},workspace:{getLeaf:()=>({openFile:async f=>window.openedPdf=f.path})}};
  window.app=app;window.files=files;window.main=main;
  const menu=new Menu();addPrintItems(menu,app,files[0]);if(menu.items.map(i=>i.title).join('|')!=='Print page…|Print full lesson…')throw Error('missing menu options');
  if(printMarkdown('---\nsecret: true\n---\nText ^id\n[[James 1#^james-1-5]]').includes('secret'))throw Error('frontmatter leaked');
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.shared=data;return Promise.resolve()}});
 });
 await page.evaluate(async()=>{const pages=await printing.lessonPages(app,'Library/Lessons/Learning');if(pages.length!==3||pages[2].selected!==false)throw Error('project selection leak');window.modal=new printing.PrintModal(app,pages);modal.open()});
 await page.getByRole('button',{name:'Continue to print',exact:true}).waitFor({timeout:60000});
 await page.screenshot({path:path.join(out,'phone-print.png')});
 await page.getByRole('button',{name:'Continue to print',exact:true}).click();
 assert.equal(await page.evaluate(()=>shared.files[0].type),'application/pdf');
 const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await shared.files[0].arrayBuffer())));
 writeFileSync(path.join(out,'lesson-standard.pdf'),Buffer.from(bytes));
 await page.getByText('Pages to include',{exact:true}).click();
 await page.locator('select').first().selectOption('18');
 await page.locator('select').nth(1).selectOption('A4');
 await page.getByRole('button',{name:'Prepare print preview',exact:true}).click();
 await page.getByRole('button',{name:'Continue to print',exact:true}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Continue to print',exact:true}).click();
 writeFileSync(path.join(out,'lesson-large.pdf'),Buffer.from(await page.evaluate(async()=>Array.from(new Uint8Array(await shared.files[0].arrayBuffer())))));
 // Share cancellation should retain the preview and allow another tap.
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:()=>Promise.reject(new DOMException('Cancelled','AbortError'))}));
 await page.getByRole('button',{name:'Continue to print',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Continue to print',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Save printable PDF to the vault'}).click();
 await page.waitForFunction(()=>window.savedPdf);
 assert.match(await page.evaluate(()=>savedPdf.path),/^Library\/Printouts\/Learning/);
 await page.evaluate(async()=>{
  const text=main+'\n\n'+'Long complete document. '.repeat(4000)+'\n\nTAIL AFTER SIXTY THOUSAND CHARACTERS';
  window.modal=new printing.PrintModal(app,[{title:'Complete page',path:files[0].path,markdown:text}]);
  printing.Platform.isMobile=false;modal.open();
 });
 await page.getByRole('button',{name:'Print…',exact:true}).waitFor({timeout:60000});
 assert.ok((await page.evaluate(()=>renderedMarkdown)).endsWith('TAIL AFTER SIXTY THOUSAND CHARACTERS'));
 const longPdf=await page.evaluate(async()=>Array.from(new Uint8Array(await modal.readyFile.arrayBuffer())));
 writeFileSync(path.join(out,'complete-long-page.pdf'),Buffer.from(longPdf));
 await page.evaluate(()=>modal.close());
 assert.deepEqual(errors,[]);
 console.log('PASS: page/full-lesson menus; project isolation and order; references optional; real PDF generation; large type/A4; iOS file share and cancellation; PDF save; full content beyond 60k characters.');
} finally {await browser.close()}
