import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/live.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
  const timers = new Map(), listeners = new Map(), queries = [], reasons = [];
  let timerId = 0;
  const p = {
    state: { device: { deviceToken: 'test-only', sync: { enabled: true } }, api: { where: async () => {}, baseUrl: 'https://test.invalid' } },
    vaultSync: { status: { lastVersion: null, lastError: null }, isSource: async () => false,
      run: async reason => { reasons.push(reason); p.vaultSync.status.lastVersion = 'v2'; p.vaultSync.status.lastError = null; } },
    checkForUpdate: async () => { throw Error('Unexpected update'); },
  };
  const context = vm.createContext({ exports: {}, URLSearchParams,
    document: { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
    window: { setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timers.delete(id) },
    require: name => {
      if (name === 'obsidian') return { requestUrl: async ({ url }) => { queries.push(new URL(url)); return { status: 200, text: JSON.stringify({ vault: 'v2', plugin: 'test-build' }) }; } };
      if (name === './build') return { BUILD: { version: 'test-build' } };
      if (name === './study/trace') return { trace() {} };
      throw Error(`Unexpected dependency ${name}`);
    },
  });
  vm.runInContext(compiled, context);
  const live = new context.exports.LiveLink(p);
  return { live, p, timers, listeners, queries, reasons };
}
{
  const f = fixture(); let attempts = 0;
  f.p.vaultSync.run = async () => {
    attempts++;
    f.p.vaultSync.status.lastError = attempts === 1 ? 'download failed' : null;
    f.p.vaultSync.status.lastVersion = attempts === 1 ? null : 'v2';
  };
  await f.live.tick();
  assert.equal(f.live.lastVault, null, 'failed sync must not acknowledge the version');
  assert.ok([...f.timers.values()].some(t => t.ms >= 4000), 'failure must back off');
  await f.live.tick();
  assert.equal(attempts, 2, 'next poll must retry unacknowledged version');
  assert.equal(f.queries[1].searchParams.get('vault'), '');
  assert.equal(f.live.lastVault, 'v2');
  await f.live.tick();
  assert.equal(f.queries[2].searchParams.get('vault'), 'v2');
  assert.equal(attempts, 2, 'acknowledged version should not copy again');
}
{
  const f = fixture();
  f.p.vaultSync.run = async () => { f.p.vaultSync.status.lastVersion = null; };
  await f.live.tick();
  assert.equal(f.live.lastVault, null, 'a run without a completed reconcile is not an acknowledgement');
}
{
  const f = fixture();
  f.p.vaultSync.run = async () => { f.p.vaultSync.status.lastVersion = 'v3'; };
  await f.live.tick();
  assert.equal(f.live.lastVault, 'v2', 'a newer completed manifest still handles the earlier live event');
}
{
  const f = fixture(), gate = deferred();
  f.p.vaultSync.run = async () => { await gate.promise; f.p.vaultSync.status.lastVersion = 'v2'; };
  const work = f.live.tick();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(f.live.lastVault, null, 'must await ongoing sync');
  f.live.stop(); gate.resolve(); await work;
  assert.equal(f.timers.size, 0, 'stopping during a request must prevent rescheduling');
}
{
  const f = fixture(); f.live.start(); f.live.lastVault = 'v2';
  f.listeners.get('visibilitychange')();
  assert.equal(f.live.lastVault, null);
  assert.deepEqual(f.reasons, ['foreground']);
  f.live.stop(); assert.equal(f.listeners.size, 0); assert.equal(f.timers.size, 0);
}
console.log('Live sync checks passed: failure retry, completed-version acknowledgement, awaited copy, stop and foreground refresh.');
