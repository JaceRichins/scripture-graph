import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = file => ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const docs=vm.createContext({exports:{},require:()=>({})});
vm.runInContext(compile('src/ai/documentContext.ts'),docs);
const stored=new Map(), sent=[]; let navigationCalls=0, documentReads=0;
class ApiError extends Error {}
const element=()=>({setText(){},createEl:()=>element(),createDiv:()=>element(),scrollIntoView(){}});
const context=vm.createContext({exports:{},window:{setInterval:()=>1,clearInterval(){}},require:name=>{
  if(name==='obsidian')return {ItemView:class {constructor(){this.app={}}},TFile:class {},Notice:class {}};
  if(name==='./documentContext')return docs.exports;
  if(name==='./readingContext')return {readingContext:()=>({chapterTitle:'Alma 36'})};
  if(name==='./actions')return {snapshot:()=>({})};
  if(name==='@scripture-graph/core-sdk')return {ApiError,navigationRequest:()=>{navigationCalls++;return null}};
  return {};
}});
vm.runInContext(compile('src/ai/askView.ts'),context);
const state={device:{userId:'researcher'},store:{get:async key=>stored.get(key),put:async(key,value)=>stored.set(key,value)},aiConnected:false};
const ai={askServer:async(question,anchor,opts)=>{sent.push({question,anchor,opts});throw new Error('Simulated connection failure')},serverStatus:async()=>({available:true,turns:[]})};
const makeView=()=>{
  const v=new context.exports.AskView({},state,ai,{},{});
  v.mode='research';v.inputEl={value:'',blur(){}};
  v.renderModes=()=>{};v.resizeComposer=()=>{};v.showChat=()=>{};v.appendTurn=()=>element();v.renderStatusLine=()=>{};
  v.app={vault:{getMarkdownFiles:()=>{documentReads++;throw new Error('Research must not open a document picker')},getAbstractFileByPath:()=>{documentReads++;throw new Error('Research must not load stale edit context')}}};
  return v;
};
const question='Research the document, compare changes in the historical record, and assess how editors revise this account. '.repeat(100);
assert.equal(docs.exports.refersToDocument(question),false,'Ordinary references must not trigger an editing workflow');
const view=makeView();view.readOnlyDocument=true;view.documentUser='researcher';view.documentPath='Library/Lessons/Old/Old.md';view.inputEl.value=question;
await view.send(question,'vault');
assert.equal(sent.length,1);assert.equal(sent[0].question,question);assert.equal(sent[0].opts.mode,'research');
assert.equal(sent[0].opts.state.currentDocument,undefined);assert.equal(documentReads,0);assert.equal(navigationCalls,0);
assert.equal(stored.get('ai:unsent-question:researcher').question,question,'Keep failed prompt for recovery');
const reopened=makeView();reopened.mode='chat';await reopened.restoreThread();
assert.equal(reopened.inputEl.value,question);assert.equal(reopened.mode,'research');
state.device.userId='another-reader';const other=makeView();await other.restoreThread();assert.equal(other.inputEl.value,'','Do not restore another account’s prompt');
state.device.userId='researcher';
ai.askServer=async(question,anchor,opts)=>{sent.push({question,anchor,opts});return {text:'Completed',actions:[],model:'Research',ms:1}};
view.renderMarkdown=async()=>{};await view.send(question,'vault');
assert.equal(stored.get('ai:unsent-question:researcher'),null,'Clear recovered prompt only after success');
console.log('Research routing: long prompt bypasses document picker, stale/read-only edit state and local navigation; failed prompt survives reopening with account isolation; success clears recovery.');

const reconnect=makeView();reconnect.serverOk=false;let statusRenders=0;
reconnect.renderStatusLine=()=>{statusRenders++};
await reconnect.refreshResearchAllowance();
assert.equal(reconnect.serverOk,true);assert.equal(statusRenders,1,'A successful recheck clears stale offline UI');
assert.equal(reconnect.checkingServer,false);
console.log('AI status recovery: successful refresh updates availability and clears stale failure banner.');

for(const mode of ['chat','research','lesson','study-plan']) {
  const v=makeView();v.mode=mode;v.documentPath='Library/Lessons/Stale/Stale.md';v.documentUser='researcher';v.readOnlyDocument=true;
  v.renderMarkdown=async()=>{};
  await v.send(question+' Where sources conflict or allow multiple interpretations, explicitly say so.','vault');
  assert.equal(sent.at(-1).opts.mode,mode);
  assert.equal(sent.at(-1).opts.state.currentDocument,undefined);
}
assert.equal(documentReads,0,'No mode scans saved folders for an ordinary prompt');
console.log('All four modes submit ordinary source-analysis prompts without stale document context or folder selection.');
