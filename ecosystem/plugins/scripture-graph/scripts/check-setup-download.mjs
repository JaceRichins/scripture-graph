import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/social/setupLink.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sections = [{ key: 'scriptures', always: true }, { key: 'family', defaultOn: false }, { key: 'conference', defaultOn: false }];
async function check(full, error = null, updated = false, annotationError = false) {
  const notices = [];
  const context = vm.createContext({ exports: {}, URLSearchParams,
    require(name) {
      if (name === 'obsidian') return { Modal: class {}, Setting: class {}, Platform: { isIosApp: true },
        Notice: class { constructor(text) { notices.push(text); } setMessage(text) { notices.push(text); } hide() {} } };
      if (name === './onboarding') return { refreshIdentity: async () => {} };
      if (name === '../build') return { BUILD: { version: '0.72.107' } };
      if (name === '../sync/vaultSync') return { SECTIONS: sections, DEFAULT_SYNC: { intervalMin: 30 } };
      throw Error(name);
    },
  });
  vm.runInContext(compiled, context);
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  let liveStarts = 0;
  const stored = new Map();
  let catalogRefreshes = 0, noteSyncs = 0;
  const plugin = {
    async checkForUpdate() { return updated; },
    ann: { async syncNow(strict) { assert.equal(strict, true); noteSyncs++; if (annotationError) throw Error('notes offline'); } },
    live: { start() { liveStarts++; } },
    state: { signedIn: true, device: { deviceToken: 'fixture', sync: { sections: { family: true, conference: true, scriptures: true }, pins: ['keep/page.md'] } },
      store: { async put(k,v) { stored.set(k,v); }, async delete(k) { stored.delete(k); } }, api: { async me() {} },
      applySettings() {}, async saveDevice() {}, notify() {} },
    async saveSharedSettings() {},
    vaultSync: { listeners: [], catalogCount: 42000, status: { files: 3000, lastError: error }, async refreshCatalog() { catalogRefreshes++; }, start() {}, async run() { await pending; } },
  };
  const run = context.exports.runSetupLink(plugin, { server: 'https://fixture.invalid', ...(full ? { download: 'all' } : {}) });
  for (let i = 0; i < 24; i++) await Promise.resolve();
  if (updated) {
    await run;
    assert.equal(stored.get(context.exports.SETUP_RESUME_KEY), true, 'An update must preserve reconnect work across reload');
    assert.equal(catalogRefreshes, 0);
    return;
  }
  assert.equal(notices.some(text => text.includes('Connected —')), false);
  assert.equal(plugin.state.device.sync.enabled, true);
  assert.equal(plugin.state.device.deviceToken, 'fixture');
  assert.deepEqual(plugin.state.device.sync.pins, ['keep/page.md']);
  assert.equal(plugin.state.device.sync.sections.family, false);
  assert.equal(plugin.state.device.sync.sections.conference, false);
  assert.equal(plugin.state.device.sync.sections.scriptures, true);
  assert.equal(plugin.state.device.sync.intervalMin, 30);
  assert.equal(liveStarts, 1);
  finish(); await run;
  assert.equal(catalogRefreshes, 1);
  assert.equal(noteSyncs, 1);
  assert.equal(stored.has(context.exports.SETUP_RESUME_KEY), false);
  assert.equal(plugin.vaultSync.listeners.length, 0);
  if (error || annotationError) assert.match(notices.at(-1), /hit a snag/);
  else { assert.match(notices.at(-1), /Connected — automatic sync is on/); assert.match(notices.at(-1), /42,000 library pages available; 3,000 files kept offline/); }
}
await check(true);
await check(false);
await check(true, 'offline');
await check(false, null, true);
await check(false, null, false, true);
console.log('Setup checks passed: lazy defaults restored even for legacy full links, account and page pins preserved, live sync restarted, completion waits, errors and cleanup.');
