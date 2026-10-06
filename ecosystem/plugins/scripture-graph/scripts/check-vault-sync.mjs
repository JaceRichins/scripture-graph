import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const source = fs.readFileSync(new URL('../src/sync/vaultSync.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const clone = value => value === undefined ? undefined : structuredClone(value);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); } throw Error('Expected test boundary was never reached'); }
function fixture(count = 3) {
  // Real content hashes: downloads are verified before they touch the vault.
  const digest = text => createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24);
  const rows = Array.from({ length: count }, (_, i) => ({ p: `AI Library/00 System/Page ${i}.md`, h: digest(`page ${i}`), text: `page ${i}` }));
  const disk = new Map(), stored = new Map(), requests = [], writes = [];
  const context = vm.createContext({ exports: {}, console, TextEncoder, Uint8Array, crypto: globalThis.crypto, atob: globalThis.atob,
    window: { setTimeout: fn => setTimeout(fn, 0) },
    require: name => {
      if (name === 'obsidian') return { Notice: class {}, Platform: { isMobile: false }, TFile: class {}, normalizePath: p => p };
      if (name === '../study/trace') return { trace() {} };
      if (name === '../state') return {};
      if (name === '../social/identity') return { refreshIdentity: async () => {} };
      if (name === './sharedCache') return { sharedCache: legacy => legacy };
      if (name === './retention') return {
        DAY: 86_400_000,
        pinMatches: (path, pin) => path === pin || (pin.endsWith('/') && path.startsWith(pin)),
        sharedDownload: path => path.startsWith('AI Library/') || path.startsWith('_media/'),
        recentConference: () => false,
        essential: () => false,
        stale: () => false,
        removeCachedCopy: async () => true,
      };
      throw Error(`Unexpected dependency: ${name}`);
    },
  });
  vm.runInContext(compiled, context);
  let manifests = 0;
  const state = { device: { deviceToken: 'test-only', sync: {} },
    store: { get: async key => clone(stored.get(key)), put: async (key, value) => stored.set(key, clone(value)) },
    app: { vault: { adapter: {
      exists: async p => disk.has(p), mkdir: async p => disk.set(p, null),
      write: async (p, text) => { disk.set(p, text); writes.push(p); },
      writeBinary: async () => { throw Error('Unexpected binary write'); },
      remove: async p => disk.delete(p),
    } } },
    api: { vaultVersion: async () => ({ version: 'v1' }),
      vaultManifest: async () => { manifests++; return { version: 'v1', files: rows }; },
      vaultBatch: async paths => { requests.push([...paths]); return { files: paths.map(p => rows.find(r => r.p === p)) }; },
    },
  };
  const sync = new context.exports.VaultSync(state, () => 'test-device');
  sync.pushPersonal = async () => {};
  sync.pullPersonal = async () => {};
  return { rows, disk, stored, requests, writes, state, sync, manifests: () => manifests };
}

// A manual request waits for existing writers AND its own fresh reconciliation.
{
  const f = fixture(1), first = deferred(), second = deferred();
  let calls = 0;
  f.state.api.vaultManifest = async () => { calls++; await (calls === 1 ? first.promise : second.promise); return { version: 'v1', files: f.rows }; };
  const underway = f.sync.run('interval');
  await until(() => calls === 1);
  let finished = false;
  const manual = f.sync.run('manual').then(() => { finished = true; });
  await tick(); assert.equal(finished, false);
  first.resolve(); await underway;
  await until(() => calls === 2);
  assert.equal(finished, false, 'manual must await fresh reconcile too');
  second.resolve(); await manual;
  assert.equal(f.sync.status.lastError, null);
}
// A live notification arriving during a copy must reconcile the newer version.
{
  const f = fixture(1), gate = deferred(); let version = 'v1', copying = false;
  f.state.api.vaultVersion = async () => ({ version });
  f.state.api.vaultManifest = async () => ({ version, files: f.rows });
  const batch = f.state.api.vaultBatch;
  f.state.api.vaultBatch = async paths => { copying = true; await gate.promise; return batch(paths); };
  const underway = f.sync.run('interval');
  await until(() => copying);
  version = 'v2';
  let settled = false;
  const live = f.sync.run('live').then(() => { settled = true; });
  await tick(); assert.equal(settled, false);
  gate.resolve(); await Promise.all([underway, live]);
  assert.equal(f.sync.status.lastVersion, 'v2', 'live change must survive an already active run');
}
// Background activity honors disabled sync; explicit manual work still works.
{
  const f = fixture(1); f.state.device.sync.enabled = false;
  for (const reason of ['interval', 'live', 'foreground']) await f.sync.run(reason);
  assert.equal(f.manifests(), 0); assert.equal(f.writes.length, 0);
  await f.sync.run('manual');
  assert.equal(f.writes.length, 1);
}
// Same manifest version is insufficient if a local file has disappeared.
{
  const f = fixture(1); await f.sync.run('manual');
  f.disk.delete(f.rows[0].p);
  await f.sync.run('manual');
  assert.equal(f.manifests(), 2);
  assert.equal(f.writes.length, 2);
  assert.equal(f.disk.get(f.rows[0].p), f.rows[0].text);
}
for (const response of [{ files: [] }, { files: [{ p: 'AI Library/00 System/Page 0.md', missing: true }] }]) {
  const f = fixture(1); f.sync.status.lastVersion = 'old-version';
  f.state.api.vaultBatch = async () => response;
  await f.sync.run('manual');
  assert.ok(f.sync.status.lastError, 'incomplete response must surface an error');
  assert.equal(f.sync.status.lastVersion, null, 'never stamp an incomplete version');
  assert.equal(f.sync.status.running, false);
}
// Three files, below the batch size: appended remainder must not be skipped.
{
  const f = fixture(3);
  f.state.api.vaultBatch = async paths => { f.requests.push([...paths]); return { files: [f.rows.find(r => r.p === paths[0])] }; };
  await f.sync.run('manual');
  assert.equal(f.sync.status.lastError, null);
  assert.deepEqual(f.requests.map(p => p.length), [3, 2, 1]);
  assert.equal(f.sync.status.done, 3); assert.equal(f.sync.status.total, 3);
  assert.equal(new Set(f.writes).size, 3);
  assert.equal(f.sync.status.lastVersion, 'v1');
}
// One worker fails after writing; another remains blocked. Lock and checkpoint
// survive failure, and retry asks only for the files not successfully written.
{
  const f = fixture(121), blocked = deferred(); let waiting = false, settled = false;
  f.state.api.vaultBatch = async paths => {
    if (paths.includes('AI Library/00 System/Page 120.md')) { waiting = true; await blocked.promise; return { files: [f.rows[120]] }; }
    return { files: [f.rows[0], { p: f.rows[1].p, missing: true }] };
  };
  const run = f.sync.run('manual').then(() => { settled = true; });
  await until(() => waiting && f.writes.length === 1);
  await tick();
  assert.equal(settled, false); assert.equal(f.sync.status.running, true);
  blocked.resolve(); await run;
  assert.ok(f.sync.status.lastError); assert.equal(f.sync.status.lastVersion, null);
  assert.equal(f.stored.get('vaultsync:index')['AI Library/00 System/Page 0.md'], f.rows[0].h);
  assert.equal(f.stored.get('vaultsync:index')['AI Library/00 System/Page 120.md'], f.rows[120].h);
  assert.equal(Object.keys(f.stored.get('vaultsync:index')).length, 2);
  await f.sync.resetIndex();
  assert.equal(Object.keys(f.stored.get('vaultsync:index')).length, 2);
  f.state.api.vaultBatch = async paths => { f.requests.push([...paths]); return { files: paths.map(p => f.rows.find(r => r.p === p)) }; };
  await f.sync.run('manual');
  assert.equal(f.sync.status.lastError, null);
  assert.equal(f.requests.flat().length, 119);
  assert.ok(!f.requests.flat().includes('AI Library/00 System/Page 0.md'));
  assert.ok(!f.requests.flat().includes('AI Library/00 System/Page 120.md'));
  assert.equal(f.sync.status.done, 119); assert.equal(f.sync.status.total, 119);
  assert.equal(f.sync.status.files, 121); assert.equal(f.sync.status.lastVersion, 'v1');
}
// A phone holding a dead address finds the laptop again and finishes the sync,
// instead of reporting failure for days (the tunnel's hostname changes).
{
  const f = fixture(2);
  let moved = false, lookups = 0;
  f.state.api.vaultVersion = async () => { if (!moved) throw Error('The server took too long to answer.'); return { version: 'v1' }; };
  f.state.rediscoverServer = async () => { lookups++; moved = true; return 'https://new-address.trycloudflare.com'; };
  await f.sync.run('manual');
  assert.equal(lookups, 1, 'one lookup when every saved address is dead');
  assert.equal(f.sync.status.lastError, null, 'the sync must succeed after reconnecting');
  assert.equal(f.sync.status.files, 2, 'the pages actually arrived');
}

// When there is genuinely nowhere to reach, the reader is told — not left guessing.
{
  const f = fixture(1);
  f.state.api.vaultVersion = async () => { throw Error('server unreachable'); };
  f.state.rediscoverServer = async () => null;
  await f.sync.run('manual');
  assert.match(f.sync.status.lastError ?? '', /unreachable/);
}

// Coming back to the app checks, but only once the interval has actually passed.
{
  const f = fixture(1);
  let runs = 0;
  const realRun = f.sync.run.bind(f.sync);
  f.sync.run = reason => { runs++; return realRun(reason); };
  f.sync.status.lastRun = new Date().toISOString();
  f.sync.catchUp();
  assert.equal(runs, 0, 'a sync from a moment ago is not repeated on every focus');
  f.sync.status.lastRun = new Date(Date.now() - 60 * 60_000).toISOString();
  f.sync.catchUp();
  assert.equal(runs, 1, 'an hour-old sync catches up when the app is reopened');
  await until(() => !f.sync.status.running);
  f.state.device.deviceToken = null;
  f.sync.status.lastRun = new Date(Date.now() - 60 * 60_000).toISOString();
  f.sync.catchUp();
  assert.equal(runs, 1, 'a vault that never joined has nothing to catch up on');
}

console.log('Vault sync checks passed: concurrent manual wait, physical repair, incomplete responses, capped batches, settled writers, checkpoint, accurate retry, address recovery and foreground catch-up.');
