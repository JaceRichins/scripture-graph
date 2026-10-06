import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out = path.resolve('../../../output/lesson-reader'); mkdirSync(out, { recursive: true });
const fixtures = {
  'obsidian': `export class ItemView {constructor(leaf){this.leaf=leaf;this.app=window.app;this.contentEl=document.createElement('main');document.body.append(this.contentEl)}async setState(){}registerEvent(){}onPaneMenu(){}} export class TFile{constructor(path){this.path=path;this.basename=path.split('/').pop().replace(/\\.md$/,'');this.parent={path:path.slice(0,path.lastIndexOf('/'))}}} export const Platform={isMobile:true};export class Menu{};export class Notice{};export const MarkdownRenderer={render:async(app,text,root)=>{text=text.replace(/^---\\n[\\s\\S]*?\\n---\\n/,'');for(const line of text.split('\\n')){if(!line.trim())continue;const h=/^(#{1,3}) (.*)/.exec(line);const e=document.createElement(h?'h'+h[1].length:'p');e.textContent=h?h[2]:line;root.append(e)}}};`,
  '../state': `export const LIBRARY_PREFIX='AI Library/';`,
  '../social/annotations': `export const COLOR_HEX={};`,
  '../study/themeLibrary': `export const THEME_LIBRARY=[];export const themeSpec=()=>({});`,
  '../study/leafNav': `export const historyBack=()=>false;export const recordHistory=()=>{};`,
  '../study/youtubeFind': `export const youtubeIdOf=async()=>null;`,
  '../study/trace': `export const trace=()=>{};`,
  '../social/pageSharing': `export const sendPage=()=>{};export const addSendPageItem=()=>{};`,
  '../printing/printMenu': `export const addPrintItems=(menu,app,file)=>{menu.printPath=file.path};`,
};
await build({ stdin: { contents: `import {DocView,DOC_VIEW,docKindFor} from './src/reader/docView';import {TFile} from 'obsidian';window.reader={DocView,DOC_VIEW,docKindFor,TFile};`, resolveDir: process.cwd() }, bundle:true,format:'iife',outfile:path.join(out,'reader.js'),plugins:[{name:'fixtures',setup(b){
  b.onResolve({filter:/.*/},args=>Object.hasOwn(fixtures,args.path)?{path:args.path,namespace:'fixture'}:null);
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:fixtures[args.path]}));
}}]});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><body class="theme-dark is-mobile sg-dock-on"></body>');
  await page.addStyleTag({path:'../../../output/timeline-preview/obsidian.css'});await page.addStyleTag({path:'styles.css'});
  await page.addStyleTag({content:'body{display:block;background:linear-gradient(160deg,#1c2529,#121c25);color:#edeae4;font-family:Arial}main{height:844px!important}'});
  await page.evaluate(()=>{
    HTMLElement.prototype.createEl=function(tag,o={}){const e=document.createElement(tag);if(o.cls)e.className=o.cls;if(o.text)e.textContent=o.text;this.append(e);return e};
    HTMLElement.prototype.createDiv=function(o){return this.createEl('div',o)};HTMLElement.prototype.createSpan=function(o){return this.createEl('span',o)};
    HTMLElement.prototype.empty=function(){this.replaceChildren()};HTMLElement.prototype.setText=function(s){this.textContent=s};HTMLElement.prototype.setAttr=function(k,v){this.setAttribute(k,v)};
    HTMLElement.prototype.addClass=function(...c){this.classList.add(...c)};HTMLElement.prototype.hasClass=function(c){return this.classList.contains(c)};HTMLElement.prototype.toggleClass=function(c,on){this.classList.toggle(c,on)};
    window.createDiv=()=>document.createElement('div');
    window.app={vault:{getAbstractFileByPath:()=>window.file,getMarkdownFiles:()=>[window.file],cachedRead:async()=>window.markdown},metadataCache:{getFileCache:()=>({frontmatter:{lesson_order:0}}),on:(_event,fn)=>{window.changed=fn}}};
  });
  await page.addScriptTag({path:path.join(out,'reader.js')});
  await page.evaluate(async()=>{
    window.file=new window.reader.TFile('Library/Lessons/He Shall Direct Thy Paths/He Shall Direct Thy Paths.md');
    window.markdown='# He Shall Direct Thy Paths\n\nCome, Follow Me · September 7–13, 2026\n\nAudience: Mixed-age family\n\nTime: 20 minutes\n\n## Aim\nHelp each person practice trusting Jesus Christ by choosing one thoughtful, kind response this week.\n\n## Before you begin\nBring your scriptures and invite someone to offer the opening prayer.\n\n## Discuss together\nWhat helps you trust the Lord when you do not know what comes next?';
    window.view=new window.reader.DocView({}, {onChange:[],settings:{themes:[]}}, {mine:async()=>[]}, {openLibrary:()=>{},openLessonHome:(folder,resources)=>{window.destination={folder,resources}},openMyWork:()=>{window.myWork=true}});
    await window.view.setState({path:window.file.path},{});await window.view.onOpen();
  });
  await page.getByRole('heading',{name:'He Shall Direct Thy Paths',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.view.getViewType()),'scripture-graph-doc');
  assert.equal(await page.locator('.sg-lesson-reading,[role=dialog],form').count(),0);
  assert.equal(await page.locator('.sg-doc-sec').count(),3);
  assert.equal(await page.getByRole('heading',{name:'He Shall Direct Thy Paths',exact:true}).count(),1);
  const styles=await page.locator('.sg-doc-page').evaluate(el=>({background:getComputedStyle(el).backgroundColor,radius:getComputedStyle(el).borderRadius,bottom:parseFloat(getComputedStyle(el).paddingBottom)}));
  assert.equal(styles.background,'rgba(0, 0, 0, 0)');assert.equal(styles.radius,'0px');assert.ok(styles.bottom>=130);
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
  assert.equal(await page.evaluate(()=>innerWidth),390);
  await page.screenshot({path:path.join(out,'full-page-phone.png'),fullPage:true});
  await page.getByRole('button',{name:'Resources',exact:true}).click();assert.equal(await page.evaluate(()=>window.destination.resources),true);
  await page.getByRole('button',{name:'‹ Lesson home'}).click();assert.equal(await page.evaluate(()=>window.destination.folder),'Library/Lessons/He Shall Direct Thy Paths');
  await page.getByRole('button',{name:'My Work',exact:true}).click();assert.equal(await page.evaluate(()=>window.myWork),true);
  assert.equal(await page.evaluate(()=>{const m={};window.view.onPaneMenu(m,'test');return m.printPath}), 'Library/Lessons/He Shall Direct Thy Paths/He Shall Direct Thy Paths.md');
  assert.equal(await page.evaluate(()=>window.view.getState().path),'Library/Lessons/He Shall Direct Thy Paths/He Shall Direct Thy Paths.md');
  await page.evaluate(()=>{window.markdown+='\n\n## New question\nWhat will you do this week?';window.changed(window.file)});
  await page.getByRole('heading',{name:'New question'}).waitFor();
  assert.equal(await page.evaluate(()=>window.reader.docKindFor('Library/Lessons/He Shall Direct Thy Paths/Resources/Preparation.md').eyebrow),'Lesson');
  await page.evaluate(async()=>{await window.view.onClose()});
  console.log('Full lesson reader: native document view/state, no embedded panel/dialog, one title, section styling, phone width, dock clearance, lesson/resources/My Work navigation, print target, and live edits passed.');
} finally {await browser.close()}
