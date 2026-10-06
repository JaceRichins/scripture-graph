import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const team = (() => { const c = vm.createContext({ exports: {} }); vm.runInContext(ts.transpileModule(readFileSync(new URL('../../../packages/core-sdk/src/ai/assistantTeam.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, c); return c.exports; })();   // the real team routing
const context = vm.createContext({ exports: {}, crypto:webcrypto, window:{setTimeout:fn=>setTimeout(fn,0)}, require:name=>name==='obsidian'?{}:{ApiError, ...team} });
vm.runInContext(ts.transpileModule(readFileSync('src/ai/aiService.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, context);
const values=new Map();let submitted=[],failOnce=true;
const finished={status:'finished',result:{ok:true,answer:'Evidence',actions:[],model:'Research',ms:1}};
const state={device:{userId:'reader',aiUsePersonalNotes:false},store:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v)},api:{
  askStatus:async()=>({available:true,modes:['chat','research','lesson','study-plan'],turns:[]}),
  startAskJob:async(id,body)=>{submitted.push({id,body});if(failOnce){failOnce=false;throw new Error('Network lost after acceptance')}return finished},askJob:async()=>finished,
}};
const ai=new context.exports.AiService(state);
await ai.askServer('Research',null,{mode:'research'});
assert.equal(submitted.length,2);assert.equal(submitted[0].id,submitted[1].id);assert.equal(submitted[0].body.mode,'research');
values.set('pending_ask_job',{id:'resume-id',userId:'reader',question:'Earlier',body:{mode:'research',question:'Earlier'}});
await ai.askServer('Earlier',null,{mode:'chat'});
assert.equal(submitted.at(-1).id,'resume-id');assert.equal(submitted.at(-1).body.mode,'research');
values.set('pending_ask_job',{id:'study-resume-id',userId:'reader',question:'Plan',body:{mode:'study-plan',question:'Plan'}});
await ai.askServer('Plan',null,{mode:'chat'});
assert.equal(submitted.at(-1).id,'study-resume-id');assert.equal(submitted.at(-1).body.mode,'study-plan');
values.set('pending_ask_job',{id:'other-account',userId:'someone-else',question:'Private question',body:{mode:'research'}});
await ai.askServer('My question',null,{mode:'chat'});
assert.notEqual(submitted.at(-1).id,'other-account');assert.equal(submitted.at(-1).body.question,'My question');
state.api.startAskJob=async()=>{throw new ApiError(429,'Three research requests used')};
await assert.rejects(ai.askServer('Fourth',null,{mode:'research'}),/Three research/);
assert.equal(values.get('pending_ask_job'),null);
console.log('Mode requests: immutable mode and request ID across reconnects/resume, account isolation, and quota rejection passed.');
