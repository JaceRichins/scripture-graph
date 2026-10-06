import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/social/identity.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { refreshIdentity } = context.exports;
function fixture() {
  const values = new Map([['ann/a', { content: 'old private note' }], ['syncq/q', { pending: true }],
    ['sync_cursor', 'old-cursor'], ['vaultsync:personal', { old: true }], ['shared:catalog', 'keep']]);
  const paths = new Set(['Library']);
  let calls = 0, failSave = false, failRename = false;
  const state = {
    signedIn: true, device: { userId: 'old-account', displayName: 'Jace', deviceToken: 'unchanged', showScopes: { groups: {} } },
    socialCache: new Map([['old', []]]), groups: [], notify() {},
    api: { async me() { calls++; return { user: { user_id: 'new-account', display_name: 'Janny Richins' }, groups: [{ group_id: 'family', name: 'Richins Family', role: 'member' }] }; } },
    store: { async get(k) { return values.get(k) ?? null; }, async put(k,v) { values.set(k,v); }, async delete(k) { values.delete(k); }, async keys(p) { return [...values.keys()].filter(k=>k.startsWith(p)); } },
    app: { vault: { adapter: { async exists(p) { return paths.has(p); }, async mkdir(p) { paths.add(p); },
      async rename(a,b) { if (failRename) throw Error('rename failed'); assert(paths.has(a)); assert(!paths.has(b)); paths.delete(a); paths.add(b); } } } },
    async saveDevice() { if (failSave) throw Error('storage failed'); },
  };
  return {state,values,paths,calls:()=>calls, failSave:v=>failSave=v, failRename:v=>failRename=v};
}
{
  const f=fixture();
  await Promise.all([refreshIdentity(f.state,true),refreshIdentity(f.state,true)]);
  assert.equal(f.calls(),1);
  assert.equal(f.state.device.userId,'new-account');
  assert.equal(f.state.device.displayName,'Janny Richins');
  assert.equal(f.state.device.deviceToken,'unchanged');
  assert.equal(f.state.groups[0].name,'Richins Family');
  assert.equal(f.state.socialCache.size,0);
  assert(!f.paths.has('Library'));
  assert([...f.paths].some(p=>p.endsWith('/Library')));
  assert(!f.values.has('ann/a')); assert(!f.values.has('syncq/q')); assert(!f.values.has('sync_cursor'));
  assert([...f.values.keys()].some(k=>k.startsWith('account-archive/') && k.endsWith('/ann/a')));
  assert.equal(f.values.get('shared:catalog'),'keep');
  f.paths.add('Library'); f.values.set('ann/new',{content:'new personal note'});
  await refreshIdentity(f.state,true);
  assert(f.paths.has('Library')); assert(f.values.has('ann/new'));
}
{
  const f=fixture(); f.failRename(true);
  await assert.rejects(refreshIdentity(f.state,true),/rename failed/);
  assert.equal(f.state.device.userId,'old-account'); assert(f.values.has('ann/a'));
  f.failRename(false); await refreshIdentity(f.state,true);
  assert.equal(f.state.device.userId,'new-account');
}
{
  const f=fixture(); f.failSave(true);
  await assert.rejects(refreshIdentity(f.state,true),/storage failed/);
  assert.equal(f.state.device.userId,'old-account');
  f.failSave(false); await refreshIdentity(f.state,true);
  assert.equal(f.state.device.userId,'new-account');
  assert.equal([...f.paths].filter(p=>p.endsWith('/Library')).length,1);
}
{
  const f=fixture(); f.state.api.me=async()=>{throw Error('offline');};
  await refreshIdentity(f.state);
  await assert.rejects(refreshIdentity(f.state,true),/offline/);
  assert.equal(f.state.device.userId,'old-account'); assert(f.paths.has('Library'));
}
console.log('Identity checks passed: account correction, preserved session, private archive, shared catalog, concurrent refresh, same-account reload, offline and failed-write recovery.');
