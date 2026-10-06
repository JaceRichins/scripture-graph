import {build} from 'esbuild';
import {readdirSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('../../../output/cfm-shelf');mkdirSync(out,{recursive:true});
const base='AI Library/07 Come Follow Me';
const catalog=Object.fromEntries(['2025','2026'].map(year=>[year,readdirSync(path.resolve('../../../Scripture Graph',base,year)).filter(name=>name.endsWith('.md')).map(name=>({name:name.slice(0,-3),path:`${base}/${year}/${name}`,remote:true}))]));
await build({stdin:{contents:`import * as cfm from './src/study/comeFollowMeShelf';import {mountCoverPhoto} from './src/study/coverPhoto';import photo from './src/assets/library-covers/come-follow-me.jpg';window.cfm=cfm;window.photo=photo;window.mountCoverPhoto=mountCoverPhoto;`,resolveDir:process.cwd()},bundle:true,format:'iife',loader:{'.jpg':'dataurl'},outfile:path.join(out,'shelf.js')});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="is-mobile is-phone theme-dark"><main class="sg-libpage"><button id="back">Back</button><h1></h1><div id="shelf"></div></main></body>');
 await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
 await page.addStyleTag({content:'body{display:block;font-family:Arial;background:#17272d;color:#eee}main{height:100vh;overflow:auto;padding:20px!important}h1{font-size:28px}#shelf{padding-bottom:120px}'});
 await page.evaluate(({base,catalog})=>{
  HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;for(const[k,v]of Object.entries(o.attr||{}))e.setAttribute(k,v);this.append(e);return e};
  HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
  window.base=base;window.catalog=catalog;window.trail=[];
 },{base,catalog});
 await page.addScriptTag({path:path.join(out,'shelf.js')});
 const stats=await page.evaluate(()=>Object.entries(window.catalog).map(([year,files])=>{const g=window.cfm.groupCfmLessons(files,Number(year));return {year,files:files.length,lessons:g.lessons.length,resources:g.resources.length,months:new Set(g.lessons.map(l=>l.month)).size,sorted:g.lessons.every((l,i,a)=>!i||l.order>=a[i-1].order),first:g.lessons[0]}}));
 for(const s of stats){assert.equal(s.lessons,52);assert.equal(s.lessons+s.resources,s.files);assert.equal(s.months,12);assert.ok(s.sorted);assert.equal(s.first.month,0);assert.ok(s.first.file.name.startsWith('December'));}
 await page.evaluate(()=>{
  window.render=(path,title,push=true)=>{if(push&&window.current)window.trail.push(window.current);window.current={path,title};document.querySelector('h1').textContent=title;const root=document.querySelector('#shelf');root.replaceChildren();window.cfm.renderComeFollowMeShelf(root,path,window.base,{
   listFolder:p=>p===window.base?{folders:['2026','2025'].map(name=>({name,path:window.base+'/'+name})),files:[]}:{folders:[],files:window.catalog[p.split('/').pop()]??[]},
   openPath:p=>{window.opened=p},go:(p,t)=>window.render(p,t),
   cover:(grid,label,onTap)=>{const card=grid.createDiv({cls:'sg-nav-cover',attr:{role:'button','aria-label':label}});const art=card.createDiv({cls:'sg-nav-cover-art'});window.mountCoverPhoto(art,[window.photo]);card.createDiv({cls:'sg-nav-cover-label',text:label});card.onclick=onTap},
   offline:(_root,p)=>{window.offlinePath=p},
  })};document.querySelector('#back').onclick=()=>{const prev=window.trail.pop();window.render(prev.path,prev.title,false)};window.render(window.base,'Come, Follow Me');
 });
 assert.deepEqual(await page.locator('.sg-nav-cover-label').allTextContents(),['2025','2026']);
 await page.getByRole('button',{name:'2026',exact:true}).click();
 assert.deepEqual(await page.locator('.sg-nav-cover-label').allTextContents(),['January','February','March','April','May','June','July','August','September','October','November','December','Resources']);
 assert.equal(await page.locator('.sg-nav-cover img').count(),13);assert.equal(await page.locator('.sg-cfm-lesson').count(),0);
 await page.locator('.sg-nav-cover img').evaluateAll(images=>Promise.all(images.map(img=>{img.loading='eager';return img.decode()})));
 assert.equal(await page.locator('.sg-nav-cover-art.sg-has-photo').count(),13);
 assert.equal(await page.evaluate(()=>window.offlinePath),base+'/2026');
 await page.screenshot({path:path.join(out,'months-phone.png'),fullPage:true});
 await page.getByRole('button',{name:'January',exact:true}).click();
 assert.deepEqual(await page.locator('.sg-cfm-lesson-date').allTextContents(),['December 29–January 4','January 5–11','January 12–18','January 19–25','January 26–February 1']);
 await page.locator('.sg-cfm-lesson').nth(2).click();assert.ok((await page.evaluate(()=>window.opened)).includes('/2026/January 12–18.'));
 await page.screenshot({path:path.join(out,'january-phone.png'),fullPage:true});
 assert.ok(await page.evaluate(()=>document.body.scrollWidth<=390));
 const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(window.current)));await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.locator('.sg-nav-cover').count(),13);
 await page.getByRole('button',{name:'Resources',exact:true}).click();assert.equal(await page.locator('.sg-cfm-lesson-date').count(),0);assert.equal(await page.locator('.sg-cfm-lesson').count(),stats.find(s=>s.year==='2026').resources);
 await page.evaluate(saved=>window.render(saved.path,saved.title),saved);assert.equal(await page.locator('.sg-cfm-lesson').count(),5);
 // Numeric date ordering, duplicate paths, invalid dates, and non-CFM shelves.
 const edge=await page.evaluate(()=>{const f=name=>({name,path:name});const files=['January 19–25. Late','January 5–11. Early','February 31. Invalid'].map(f);files.push(files[0]);const g=window.cfm.groupCfmLessons(files,2026);return {names:g.lessons.map(l=>l.title),resources:g.resources.length,other:window.cfm.renderComeFollowMeShelf(document.createElement('div'),'Other',window.base,{})}});
 assert.deepEqual(edge,{names:['Early','Late'],resources:1,other:false});
 console.log('Come, Follow Me passed: all 104 lessons across two years, 12 chronological months per year, opening cross-year week, numeric date sorting, resources separated, photos, real file destinations, remote catalog, offline year target, Back/restored state, and phone layout.');
}finally{await browser.close()}
