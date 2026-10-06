import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/sync/sharedCache.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const databases = new Map(), events = [];
let failWrite = false;
const indexedDB = {
  open(name) {
    const request = {};
    queueMicrotask(() => {
      const fresh = !databases.has(name);
      if (fresh) databases.set(name, new Map());
      const data = databases.get(name);
      request.result = {
        createObjectStore() {},
        transaction() {
          const tx = {
            objectStore() {
              return {
                get(key) {
                  const result = { result: structuredClone(data.get(key)) };
                  queueMicrotask(() => tx.oncomplete());
                  return result;
                },
                put(value, key) {
                  const snapshot = structuredClone(value);
                  queueMicrotask(() => {
                    if (failWrite) { tx.error = new Error('quota'); tx.onabort(); return; }
                    data.set(key, snapshot); events.push('committed:' + key); tx.oncomplete();
                  });
                },
              };
            },
          };
          return tx;
        },
      };
      if (fresh) request.onupgradeneeded();
      request.onsuccess();
    });
    return request;
  },
};
function legacyStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key) { return data.get(key) ?? null; },
    async put(key, value) { data.set(key, value); },
    async delete(key) { events.push('deleted:' + key); data.delete(key); },
  };
}
const context = vm.createContext({ exports: {}, indexedDB });
vm.runInContext(compiled, context);
const { sharedCache } = context.exports;
const oldIndex = { 'AI Library/chapter.md': 'abc' };
const legacy = legacyStore({ 'vaultsync:index': oldIndex, device: { token: 'fixture' } });
const cache = sharedCache(legacy, 'dad');
assert.deepEqual(await cache.get('vaultsync:index'), oldIndex);
assert.deepEqual(events.slice(0, 2), ['committed:vaultsync:index', 'deleted:vaultsync:index']);
assert.equal(legacy.data.has('vaultsync:index'), false);
assert.deepEqual(legacy.data.get('device'), { token: 'fixture' });
const full = Object.fromEntries(Array.from({ length: 20000 }, (_, i) => [`AI Library/collection/${i}.md`, '0123456789abcdef01234567']));
await cache.put('vaultsync:index', full);
assert.equal(Object.keys(await sharedCache(legacy, 'dad').get('vaultsync:index')).length, 20000);
assert.equal(await sharedCache(legacyStore(), 'mom').get('vaultsync:index'), null);

const prior = legacyStore({ 'vaultsync:index': oldIndex });
failWrite = true;
await assert.rejects(sharedCache(prior, 'retry').get('vaultsync:index'), /quota/);
assert.deepEqual(prior.data.get('vaultsync:index'), oldIndex);
failWrite = false;
assert.deepEqual(await sharedCache(prior, 'retry').get('vaultsync:index'), oldIndex);

const fallback = vm.createContext({ exports: {} });
vm.runInContext(compiled, fallback);
assert.equal(fallback.exports.sharedCache(legacy, 'old-runtime'), legacy);
console.log('Shared cache checks passed: migration after commit, failure preserves old index, 20,000 entries, per-vault isolation, personal storage untouched.');
