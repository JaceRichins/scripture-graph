import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/bookmark-position'); mkdirSync(out, { recursive: true });
await build({ stdin: { contents: `import {trackBookmarkPosition} from './src/study/bookmarkPosition'; import {rememberReadingPosition} from './src/study/readingPosition'; import {BookmarkReading} from './src/study/bookmarkReading'; import {MarkdownView,TFile} from 'obsidian'; window.api={trackBookmarkPosition,rememberReadingPosition,BookmarkReading,MarkdownView,TFile};`, resolveDir:process.cwd() }, bundle:true,format:'iife',outfile:path.join(out,'test.js'),
  plugins:[{name:'obsidian-boundary',setup(b){b.onResolve({filter:/^obsidian$/},()=>({path:'obsidian',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export class TFile {constructor(path){this.path=path}};export class MarkdownView {};export function requestUrl(){};`}))}}]
});
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#112533;color:#eee;font:20px Georgia}main{height:740px;overflow:auto;overflow-anchor:none}p{margin:0;height:100px;padding:0 18px;box-sizing:border-box}</style><main></main>');
  await page.addScriptTag({path:path.join(out,'test.js')});
  await page.evaluate(()=>{
    window.db=new Map();window.marks=new Map();window.account='jace';window.delay=0;
    window.create=()=>{
      const root=document.querySelector('main');
      window.fill=name=>{root.innerHTML=Array.from({length:45},(_,i)=>`<p>${name}: paragraph ${i+1}</p>`).join('')};
      window.view=window.api.rememberReadingPosition({containerEl:root,contentEl:root,state:null,
        getEphemeralState(){return {}}, setEphemeralState(s){if(s.subpath||s.scroll!=null)root.scrollTop=s.scroll??300},
        async setState(name){this.state=name;root.replaceChildren();root.scrollTop=0;await new Promise(r=>setTimeout(r,60));window.fill(name)},onClose(){}
      });
      window.tracker=window.api.trackBookmarkPosition(window.view,{
        page:()=>window.view.state,root:()=>root,
        bookmark:async name=>{const key=window.marks.get(`${window.account}:${name}`);await new Promise(r=>setTimeout(r,window.delay));return key??null},
        read:async key=>window.db.get(key)??null,write:async(key,position)=>{window.db.set(key,structuredClone(position))}
      });
    };window.create();
    window.readAt=top=>{const root=window.view.contentEl;root.dispatchEvent(new Event('touchstart'));root.scrollTop=top;root.dispatchEvent(new Event('scroll'))};
  });
  await page.evaluate(async()=>{await window.view.setState('Alma 36');window.readAt(1350);window.marks.set('jace:Alma 36','jace:mark1');await window.tracker.refresh()});
  assert.equal(await page.evaluate(()=>window.db.get('jace:mark1').top),1350,'bookmark captures current position');
  await page.evaluate(async()=>{await window.view.setState('Home');await window.view.setState('Alma 36')});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===1350);
  // Continue reading; leave before the debounce expires. Any normal navigation resumes the latest spot.
  await page.evaluate(async()=>{window.readAt(1850);await window.view.setState('Home');await window.view.setState('Alma 36')});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===1850);
  // Restore after a plugin restart, with only persisted data retained.
  await page.evaluate(async()=>{window.view.onClose();window.create();await window.view.setState('Alma 36')});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===1850);
  // The same text anchor follows layout changes instead of landing above the passage.
  await page.evaluate(()=>{const p=document.createElement('p');p.textContent='Late image';window.view.contentEl.prepend(p)});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===1950);
  // Direct verse links win even when bookmark lookup is delayed.
  await page.evaluate(async()=>{await window.view.setState('Home');window.delay=100;const opening=window.view.setState('Alma 36');window.view.setEphemeralState({subpath:'#^alma-36-3'});await opening;window.delay=0;window.view.setEphemeralState({subpath:'#^alma-36-3'})});
  await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),300);
  // Native Back/Forward remains independent of the bookmark's latest position.
  await page.evaluate(async()=>{await window.view.setState('Home');const opening=window.view.setState('Alma 36');window.view.setEphemeralState({sgReadingPosition:{top:850,left:0}});await opening});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===850);
  // Touch before the lookup completes prevents a surprise jump.
  await page.evaluate(async()=>{await window.view.setState('Home');window.delay=150;const opening=window.view.setState('Alma 36');await new Promise(r=>setTimeout(r,90));window.readAt(450);await opening;window.delay=0});
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),450);
  // Removing a bookmark disables resume; another account cannot inherit its location.
  await page.evaluate(async()=>{window.marks.delete('jace:Alma 36');await window.tracker.refresh();await window.view.setState('Home');await window.view.setState('Alma 36')});
  assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),0);
  await page.evaluate(async()=>{window.account='brett';await window.view.setState('Home');await window.view.setState('Alma 36')});
  assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),0);
  // Existing bookmarks acquire a position on the first reading visit, including returning to the top.
  await page.evaluate(async()=>{window.marks.set('brett:Alma 36','brett:mark2');await window.tracker.refresh();window.readAt(700);window.tracker.flush();await window.view.setState('Home');await window.view.setState('Alma 36')});
  await page.waitForFunction(()=>window.view.contentEl.scrollTop===700);
  await page.evaluate(async()=>{window.readAt(0);await window.view.setState('Home');await window.view.setState('Alma 36')});
  assert.equal(await page.evaluate(()=>window.view.contentEl.scrollTop),0);
  // Production adapter on native Markdown: scroll belongs to the nested preview,
  // not the workspace container. It must work when first opened and when reused.
  await page.evaluate(async()=>{
    window.view.onClose();
    const container=document.querySelector('main');container.style.overflow='hidden';
    container.innerHTML='<div class="markdown-preview-view" style="height:100%;overflow:auto;overflow-anchor:none"></div>';
    const preview=container.firstElementChild;
    const native=new window.api.MarkdownView();
    Object.assign(native,{containerEl:container,path:'Alma 36.md',getViewType:()=> 'markdown',getMode:()=> 'preview',getState(){return {file:this.path}},
      async setState(state){this.path=state.file;preview.innerHTML='';await new Promise(r=>setTimeout(r,60));preview.innerHTML=Array.from({length:40},(_,i)=>`<p>Verse ${i+1}</p>`).join('')},
      setEphemeralState(s){if(s.subpath)preview.scrollTop=300},onClose(){}
    });
    await native.setState({file:'Alma 36.md'});
    const file=new window.api.TFile('Alma 36.md');
    window.nativeDb=new Map([['bookmark-position:jace:mark-native',{top:1200,left:0}]]);
    window.native=native;window.preview=preview;
    window.manager=new window.api.BookmarkReading({device:{userId:'jace'},app:{vault:{getAbstractFileByPath:p=>p===file.path?file:null},workspace:{iterateAllLeaves:fn=>fn({view:native})}},
      store:{get:async key=>window.nativeDb.get(key),put:async(key,value)=>window.nativeDb.set(key,value)}
    },{bookmarkOf:async()=>({annotation_id:'mark-native',author_user_id:'jace'}),
      syncedPlace:async id=>window.syncedPlaces.get(id)??null,
      persistPlace:async(id,f,place)=>{window.persisted.push({id,path:f.path,top:place.top})}});
    window.syncedPlaces=new Map();window.persisted=[];
    window.manager.scan();
  });
  await page.waitForFunction(()=>window.preview.scrollTop===1200);
  await page.evaluate(async()=>{
    window.preview.dispatchEvent(new Event('touchstart',{bubbles:true}));window.preview.scrollTop=1700;window.manager.flush();
    await window.native.setState({file:'Home.md'});await window.native.setState({file:'Alma 36.md'});
  });
  await page.waitForFunction(()=>window.preview.scrollTop===1700);
  // Leaving the page writes the place into the bookmark itself, once, for other devices.
  assert.deepEqual(await page.evaluate(()=>window.persisted.at(-1)),{id:'mark-native',path:'Alma 36.md',top:1700});
  // A newer place saved on another device wins over this device's older one.
  await page.evaluate(async()=>{window.syncedPlaces.set('mark-native',{place:{top:600,left:0},at:'2999-01-01T00:00:00.000Z'});await window.native.setState({file:'Home.md'});await window.native.setState({file:'Alma 36.md'})});
  await page.waitForFunction(()=>window.preview.scrollTop===600);
  await page.evaluate(()=>window.syncedPlaces.clear());
  await page.evaluate(async()=>{
    window.native.setEphemeralState({subpath:'#verse-3'});
    await window.native.setState({file:'Alma 36.md',mode:'preview'});
    window.native.setEphemeralState({subpath:'#verse-3'});
  });
  await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.preview.scrollTop),300);
  await page.evaluate(()=>window.manager.dispose());
  console.log('Bookmark positions passed: capture, continued reading, ordinary navigation, restart, layout reflow, explicit verses, Back/Forward, touch cancellation, removal, account separation, existing bookmarks and top-of-page updates.');
} finally { await browser.close(); }
