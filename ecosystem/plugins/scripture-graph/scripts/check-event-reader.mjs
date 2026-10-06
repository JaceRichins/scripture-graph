// Exercise the production DocView and leaf history with the actual vault files.
import { build } from 'esbuild';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const runtime='C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(runtime+'/playwright');
const markedPath=require.resolve(runtime+'/marked').replaceAll('\\','/');
const out=path.resolve('../../../output/kirtland-research-2/reader');mkdirSync(out,{recursive:true});
const vault=path.resolve('../../../Scripture Graph');
const event='AI Library/05 Events/Priesthood keys restored in the Kirtland Temple.md';
const files={[event]:readFileSync(path.join(vault,event),'utf8')};
const history='AI Library/30 Church History';
for(const dir of ['Kirtland Records','Joseph Smith Papers/Texts']) {
  for(const file of readdirSync(path.join(vault,history,dir))) {
    if(!file.endsWith('.md'))continue;
    const rel=`${history}/${dir}/${file}`;files[rel]=readFileSync(path.join(vault,rel),'utf8');
  }
}
const fixtures={
  obsidian:`import {marked} from ${JSON.stringify(markedPath)};
    export class ItemView{constructor(leaf){this.leaf=leaf;this.app=window.app;this.contentEl=document.createElement('main');document.body.append(this.contentEl)}async setState(){}registerEvent(){}onPaneMenu(){}}
    export class TFile{constructor(path){this.path=path;this.basename=path.split('/').pop().replace(/\\.md$/,'');this.parent={path:path.slice(0,path.lastIndexOf('/'))}}}
    export const Platform={isMobile:true};export class Notice{};
    export class Menu{items=[];addItem(fn){const item={setTitle(t){this.title=t;return this},setIcon(i){this.icon=i;return this},onClick(fn){this.callback=fn;return this}};fn(item);this.items.push(item)}}
    export class Modal{constructor(app){this.app=app;this.modalEl=document.createElement('section');this.modalEl.className='modal';this.modalEl.setAttribute('role','dialog');this.contentEl=document.createElement('div');this.modalEl.append(this.contentEl)}open(){document.body.append(this.modalEl);window.openModal=this;void this.onOpen()}close(){this.onClose();this.modalEl.remove()}}
    export const MarkdownRenderer={render:async(app,text,root)=>{text=text.replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n/,'');text=text.replace(/\\[\\[([^\\]|]+)(?:\\|([^\\]]+))?\\]\\]/g,(_,href,label)=>'<a class="internal-link" data-href="'+href+'" href="#">'+(label||href)+'</a>');root.innerHTML=marked.parse(text)}};`,
  '../state':`export const LIBRARY_PREFIX='AI Library/';`,
  '../social/annotations':`export const COLOR_HEX={};`,
  '../study/themeLibrary':`export const THEME_LIBRARY=[];export const themeSpec=()=>({});`,
  '../study/youtubeFind':`export const youtubeIdOf=async()=>null;`,
  '../study/trace':`export const trace=()=>{};`,
  '../printing/printMenu':`export const addPrintItems=(menu,app,file)=>{menu.printPath=file.path};`,
};
await build({stdin:{contents:`import {DocView,DOC_VIEW,docKindFor} from './src/reader/docView';import {FamilyInboxModal} from './src/social/pageSharing';import {TFile,Menu} from 'obsidian';window.reader={DocView,DOC_VIEW,docKindFor,FamilyInboxModal,TFile,Menu};`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:path.join(out,'reader.js'),plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(fixtures,a.path)?{path:a.path,namespace:'fixture'}:null);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:fixtures[a.path],resolveDir:process.cwd()}))}}]});
const browser=await chromium.launch({headless:true});
try {
 for(const width of [390,768]){
  const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile sg-dock-on"></body>');
  await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
  await page.addStyleTag({content:'body{display:block;background:#16222a;color:#edeae4;font-family:Arial}main{height:844px!important}.modal{position:fixed;inset:10% 12px auto;max-height:80vh;width:auto;padding:20px;overflow:auto;background:#232323;border-radius:16px;z-index:100}'});
  await page.evaluate(({files})=>{
    window.files=files;
    HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;if(o.type)e.type=o.type;for(const[k,v]of Object.entries(o.attr??{}))e.setAttribute(k,v);this.append(e);return e};
    HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
    HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.setText=function(s){this.textContent=s};HTMLElement.prototype.setAttr=function(k,v){this.setAttribute(k,v)};HTMLElement.prototype.getAttr=function(k){return this.getAttribute(k)};
    HTMLElement.prototype.addClass=function(...c){this.classList.add(...c)};HTMLElement.prototype.hasClass=function(c){return this.classList.contains(c)};HTMLElement.prototype.toggleClass=function(c,on){this.classList.toggle(c,on)};
    window.createDiv=()=>document.createElement('div');
    if(!crypto.randomUUID)crypto.randomUUID=()=> '00000000-0000-4000-8000-000000000001';
    window.app={vault:{getAbstractFileByPath:p=>window.entries[p]??null,getMarkdownFiles:()=>Object.values(window.entries),cachedRead:async f=>window.files[f.path]},metadataCache:{getFileCache:()=>({frontmatter:{}}),getFirstLinkpathDest:p=>window.entries[p+'.md']??Object.values(window.entries).find(f=>f.basename===p),on:(_event,fn)=>{window.changed=fn}},workspace:{openLinkText:(href)=>{window.otherLink=href}}};
  },{files});
  await page.addScriptTag({path:path.join(out,'reader.js')});
  await page.evaluate(async({event})=>{
    window.entries=Object.fromEntries(Object.keys(window.files).map(p=>[p,new window.reader.TFile(p)]));
    window.leaf={history:{backHistory:[],forwardHistory:[],back(){const prior=this.backHistory.pop();if(prior)void window.leaf.setViewState(prior.state)}},getViewState:()=>({type:window.view.getViewType(),state:window.view.getState()}),async setViewState(s){window.lastNavigation=s;await window.view.setState(s.state,{})}};
    window.deliveries=[];
    window.view=new window.reader.DocView(window.leaf,{app:window.app,signedIn:true,onChange:[],settings:{themes:[]},api:{pageRecipients:async()=>({recipients:[{user_id:'alice',display_name:'Alice'},{user_id:'ben',display_name:'Ben'},{user_id:'casey',display_name:'Casey'}]}),sendPage:async payload=>{window.deliveries.push(payload);return{sent:payload.recipients.length}}}},{mine:async()=>[]},{openLibrary:()=>{window.libraryOpened=true}});window.leaf.view=window.view;
    await window.view.setState({path:event},{});await window.view.onOpen();
  },{event});
  const title='Priesthood keys restored in the Kirtland Temple';
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:title,exact:true}).count(),1);
  assert.equal(await page.locator('form,[role=dialog],.modal-container').count(),0);
  assert.equal(await page.locator('.sg-doc-sec').count(),6);
  assert.equal(await page.evaluate(()=>window.reader.docKindFor('AI Library/05 Events/Events.md')),null);
  assert.equal(await page.evaluate(({event})=>window.reader.docKindFor(event).eyebrow,{event}),'Event');
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth && document.querySelector('main').scrollWidth<=innerWidth));
  assert.equal(await page.evaluate(()=>window.view.getViewType()),'scripture-graph-doc');
  await page.screenshot({path:path.join(out,`event-${width}.png`)});
  if(process.argv.includes('--scroll-regression')) {
    // A routine notification must leave both the current DOM and position alone.
    await page.evaluate(async()=>{window.scrollRoot=window.view.contentEl;window.scrollRoot.scrollTop=1600;window.readingNode=window.scrollRoot.firstElementChild;await window.view.render()});
    assert.equal(await page.evaluate(()=>window.scrollRoot.scrollTop),1600);
    assert.equal(await page.evaluate(()=>window.scrollRoot.firstElementChild===window.readingNode),true);
    // Brief file-read failures during sync previously rendered a one-line error,
    // clamping the scroll to zero before the next successful refresh.
    const errorResult=await page.evaluate(async()=>{
      const read=window.app.vault.cachedRead;
      window.app.vault.cachedRead=async()=>{throw new Error('Transient sync read failure')};
      await window.view.render();const during=window.scrollRoot.scrollTop;
      window.app.vault.cachedRead=read;await window.view.render();
      return {during,after:window.scrollRoot.scrollTop,sameDOM:window.scrollRoot.firstElementChild===window.readingNode};
    });
    assert.deepEqual(errorResult,{during:1600,after:1600,sameDOM:true},'temporary sync failure must not discard the visible page');
    const emptyResult=await page.evaluate(async()=>{
      const read=window.app.vault.cachedRead;window.app.vault.cachedRead=async()=>'';
      await window.view.render();const during=window.scrollRoot.scrollTop;
      window.app.vault.cachedRead=read;await window.view.render();
      return {during,after:window.scrollRoot.scrollTop};
    });
    assert.deepEqual(emptyResult,{during:1600,after:1600},'a briefly empty file during a write must not discard the page');
    await page.evaluate(async({event})=>{const file=window.entries[event];delete window.entries[event];await window.view.render();window.entries[event]=file;await window.view.render()},{event});
    assert.equal(await page.evaluate(()=>window.scrollRoot.scrollTop),1600,'temporary index removal must not discard the page');
    // Hidden mobile tabs report zero layout metrics even though the reader was
    // deep in the page. A background notification must not save that as the top.
    await page.evaluate(async({event})=>{window.scrollRoot.style.display='none';window.files[event]+='\n\nA newly synced closing sentence.';await window.view.render();window.scrollRoot.style.display='';},{event});
    await page.evaluate(()=>new Promise(requestAnimationFrame));
    assert.equal(await page.evaluate(()=>window.scrollRoot.scrollTop),1600,'hidden refresh must not reset the reader');
    // Continue reading while an asynchronous refresh is being prepared.
    await page.evaluate(async()=>{
      const read=window.app.vault.cachedRead;let release;const gate=new Promise(resolve=>{release=resolve});
      window.app.vault.cachedRead=async f=>{await gate;return read(f)};
      const refreshing=window.view.render();window.scrollRoot.scrollTop=2100;release();await refreshing;window.app.vault.cachedRead=read;
    });
    assert.equal(await page.evaluate(()=>window.scrollRoot.scrollTop),2100,'refresh must use the latest reading position');
    // A deliberately cleared document must eventually apply; keeping the old
    // page during a write must not turn into permanently stale content.
    await page.evaluate(async()=>{window.originalRead=window.app.vault.cachedRead;window.app.vault.cachedRead=async()=>'';await window.view.render()});
    await page.waitForFunction(()=>window.view.contentEl.querySelector('.sg-doc-body')?.textContent==='');
    await page.evaluate(async()=>{window.app.vault.cachedRead=window.originalRead;await window.view.render()});
    // The safeguard belongs to the same document only: missing destinations
    // still show their own error instead of displaying the previous event.
    await page.evaluate(async()=>{await window.view.setState({path:'AI Library/05 Events/Missing test event.md'}, {})});
    assert.equal(await page.locator('main').innerText(),'This page is not in the vault.');
    await page.evaluate(async({event})=>{await window.view.setState({path:event},{})},{event});
    await page.evaluate(()=>{window.scrollRoot.scrollTop=0});
  }
  await page.getByRole('navigation',{name:'On this event page'}).getByRole('button',{name:'Sources',exact:true}).click();
  await page.waitForFunction(()=>{const h=[...document.querySelectorAll('h2')].find(h=>h.textContent==='Historical Sources');return h.getBoundingClientRect().top>=-2 && h.getBoundingClientRect().top<30});
  await page.screenshot({path:path.join(out,`sources-${width}.png`)});
  const sourceLabels=['Read the original vision account',"Read Phelps's letter",'Read the journal selection','Read the printed minutes and prayer',"Read Partridge's diary selection","Read Post's journal selection","Read Brown's surviving fragments",'Read the relevant passage','Read the April 3 history entry'];
  for(const label of sourceLabels){
    await page.getByRole('link',{name:label,exact:true}).click();
    await page.waitForFunction(event=>window.view.getState().path!==event,event);
    assert.equal(await page.evaluate(()=>window.lastNavigation.type),'scripture-graph-doc');
    assert.equal(await page.locator('form,[role=dialog]').count(),0);
    assert.ok(await page.locator('.sg-doc-body').innerText());
    assert.ok(await page.evaluate(()=>document.querySelector('main').scrollTop===0));
    if(label==="Read Phelps's letter")await page.screenshot({path:path.join(out,`letter-${width}.png`)});
    await page.getByRole('button',{name:'‹ Back',exact:true}).click();
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.view.getState().path),event);
  }
  const menuItems=await page.evaluate(()=>{window.pageMenu=new window.reader.Menu();window.view.onPaneMenu(window.pageMenu,'more-options');return{printPath:window.pageMenu.printPath,items:window.pageMenu.items.map(i=>({title:i.title,icon:i.icon}))}});
  assert.equal(menuItems.printPath,event);assert.deepEqual(menuItems.items,[{title:'Send page…',icon:'send'}]);
  await page.evaluate(()=>{window.view.contentEl.scrollTop=1300;window.pageMenu.items[0].callback()});
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Ben',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('checkbox',{checked:true}).count(),0);
  assert.equal(await dialog.getByRole('button',{name:'Send page',exact:true}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>window.deliveries.length),0);
  await dialog.getByLabel('Ben',{exact:true}).check();
  await dialog.getByLabel('Message (optional)').fill('An interesting historical source.');
  await page.screenshot({path:path.join(out,`send-picker-${width}.png`)});
  await dialog.getByRole('button',{name:'Send page',exact:true}).click();
  await dialog.waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>window.deliveries.map(({recipients,path,message})=>({recipients,path,message}))),[{recipients:['ben'],path:event,message:'An interesting historical source.'}]);
  assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),1300,'sending must preserve the page position');
  await page.evaluate(({event})=>{
    window.receipts=[];window.openedSent=[];window.folderCalls=[];
    const common={path:event,title:'Priesthood keys restored in the Kirtland Temple',created_at:'2026-09-14T09:00:00Z',read_at:null,message:'The original journal account is worth reading.'};
    window.inbox=new window.reader.FamilyInboxModal({app:window.app,api:{
      pageInbox:async()=>{window.folderCalls.push('incoming');return{items:[{...common,id:11,sender_name:'Alice'}],unread:1,next:null}},
      pageSent:async()=>{window.folderCalls.push('sent');return{items:[{...common,id:13,recipient_name:'Ben'},{...common,id:12,recipient_name:'Casey',read_at:'2026-09-14T10:30:00Z',message:''}],next:null}},
      readSharedPage:async id=>{window.receipts.push(id)},
    }},async path=>{window.openedSent.push(path)});window.inbox.open();
  },{event});
  await dialog.getByRole('button',{name:'Incoming · 1 new',exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Incoming · 1 new',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok((await dialog.innerText()).includes('New · From Alice'));
  await page.screenshot({path:path.join(out,`inbox-incoming-${width}.png`)});
  await dialog.getByRole('button',{name:'Sent',exact:true}).click();
  await dialog.getByText('To Ben',{exact:false}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Sent',exact:true}).getAttribute('aria-pressed'),'true');
  assert.ok((await dialog.innerText()).includes('To Casey'));assert.ok((await dialog.innerText()).includes('Opened'));
  assert.ok(!(await dialog.innerText()).includes('From Alice'));
  await dialog.getByRole('button',{name:'Refresh',exact:true}).click();
  await dialog.getByText('To Ben',{exact:false}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.folderCalls),['incoming','sent','sent']);
  assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),'inbox must fit the phone width');
  assert.ok(await dialog.locator('.sg-family-inbox-tabs button').evaluateAll(nodes=>nodes.every(e=>e.getBoundingClientRect().height>=44)),'folder buttons must remain touch-sized');
  await page.screenshot({path:path.join(out,`inbox-sent-${width}.png`)});
  await dialog.getByRole('button',{name:title,exact:true}).first().click();
  await dialog.waitFor({state:'detached'});
  assert.deepEqual(await page.evaluate(()=>window.openedSent),[event]);
  assert.deepEqual(await page.evaluate(()=>window.receipts),[],'opening a sent page must not mark it read for the recipient');
  await page.evaluate(({event})=>{window.files[event]+='\n\n## Reader verification\nUpdated source notes.';window.changed(window.entries[event])},{event});
  await page.getByRole('heading',{name:'Reader verification',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Event reader passed at 390px and 768px: full page, one title, six sections, no dialog/form or overflow, all nine historical links, native back history, source starts at top, print, live refresh, Send page, and Incoming/Sent inbox folders with independent read receipts.'+(process.argv.includes('--scroll-regression')?' Scroll regressions passed: unchanged notifications, failed/empty/missing reads, hidden updates, reading during refresh, intentional clearing, and separate missing destinations.':''));
}finally{await browser.close()}
