import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const context = vm.createContext({ exports: {} });
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/study/defaultAppearance.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { applyDefaultAppearance } = context.exports;

let theme = 'moonstone', writes = 0, refreshes = 0, saved;
const state = {
  app: {
    vault: {},
    changeTheme(value) { theme = value; },
    updateTheme() { refreshes++; },
  },
  device: { scene: 'none' },
  async saveDevice() { writes++; saved = JSON.parse(JSON.stringify(this.device)); },
};
assert.equal(await applyDefaultAppearance(state), 'applied');
assert.equal(theme, 'obsidian');
assert.equal(state.device.scene, 'match');
assert.equal(saved.appearanceDefaultsVersion, 1);
assert.equal(refreshes, 1);

// Reload the persisted device state, then manually choose light and another
// background. A future plugin load must respect both choices.
state.device = { ...saved, scene: 'waters' };
theme = 'moonstone';
assert.equal(await applyDefaultAppearance(state), 'already-applied');
assert.equal(theme, 'moonstone');
assert.equal(state.device.scene, 'waters');
assert.equal(writes, 1);
assert.equal(refreshes, 1);

// Another family device has its own marker and receives the defaults once.
state.device = { scene: 'auto' };
assert.equal(await applyDefaultAppearance(state), 'applied');
assert.equal(theme, 'obsidian');
assert.equal(state.device.scene, 'match');
assert.equal(writes, 2);

const fallbackCalls = [];
const fallback = {
  app: { vault: { setConfig(...args) { fallbackCalls.push(args); } }, updateTheme() { fallbackCalls.push('refresh'); } },
  device: { scene: 'none' }, async saveDevice() {},
};
assert.equal(await applyDefaultAppearance(fallback), 'applied');
assert.deepEqual(fallbackCalls, [['theme', 'obsidian'], 'refresh']);

const unsupported = { app: { vault: {} }, device: { scene: 'sunrise' }, async saveDevice() { assert.fail('must not mark unsupported runtime'); } };
assert.equal(await applyDefaultAppearance(unsupported), 'unavailable');
assert.equal(unsupported.device.scene, 'sunrise');
assert.equal(unsupported.device.appearanceDefaultsVersion, undefined);

const broken = { app: state.app, device: { scene: 'garden' }, async saveDevice() { throw Error('storage unavailable'); } };
await assert.rejects(applyDefaultAppearance(broken), /storage unavailable/);
assert.equal(broken.device.scene, 'garden');
assert.equal(broken.device.appearanceDefaultsVersion, undefined);
broken.saveDevice = async () => {};
assert.equal(await applyDefaultAppearance(broken), 'applied');
console.log('Appearance checks passed: one-time dark + page matching defaults, persistence, manual choices, independent devices, API fallback, unsupported runtime and retry after failed persistence.');
