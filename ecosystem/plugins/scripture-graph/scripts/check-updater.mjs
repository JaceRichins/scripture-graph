import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the production method with Obsidian's network/disk boundary mocked.
const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('  private updateRunning = false;'), source.indexOf('  /** Also adopt builds'));
const channelFunctions = fs.readFileSync(new URL('../src/sync/updateChannel.ts', import.meta.url), 'utf8').replaceAll('export ', '');
const buildSource = fs.readFileSync(new URL('../src/build.ts', import.meta.url), 'utf8');
const bannerDefinition = buildSource.slice(buildSource.indexOf('export const BANNER_RE')).replace('export ', '');
const compiled = ts.transpile(`${channelFunctions}\n${bannerDefinition}\nclass Updater { ${method} }; globalThis.Updater = Updater;`);
const root = 'https://github.com/JaceRichins/scripture-graph/releases';
async function run({ current = '0.72.60', remote = '0.72.61', broken = false, offline = false, typing = false, silent = true } = {}) {
  const urls = [], writes = [];
  let fallback = 0;
  const context = vm.createContext({
    BUILD: { version: current },
    document: { hidden: false, activeElement: { matches: () => typing } },
    window: { setTimeout: () => 1, clearTimeout: () => {} },
    Notice: class {},
    requestUrl: async ({ url }) => {
      urls.push(url);
      if (offline && url.startsWith(root)) throw new Error('offline');
      if (url.endsWith('manifest.json')) return { status: 200, text: JSON.stringify({ id: 'scripture-graph', version: url.startsWith(root) || offline ? remote : '0.72.59' }) };
      if (url.endsWith('main.js')) return { status: 200, text: `/* scripture-graph v${broken ? '0.72.59' : remote} build abc123 2026-09-09 */` + ' '.repeat(10000) };
      return { status: 200, text: 'body {}' };
    },
  });
  vm.runInContext(compiled, context);
  const updater = new context.Updater();
  updater.state = { api: { where: async () => { fallback++; }, baseUrl: 'https://family.example' } };
  updater.app = { vault: { configDir: '.obsidian', adapter: { write: async (path) => writes.push(path) } } };
  const updated = await updater.checkForUpdate(silent);
  return { urls, writes, fallback, updated };
}
const success = await run();
assert.equal(success.fallback, 1, 'Both update channels are checked to find the newest version');
assert.equal(success.writes.length, 3);
assert.ok(success.writes[2].endsWith('manifest.json'));
assert.ok(success.urls.includes(`${root}/download/0.72.61/main.js`));
assert.equal((await run({ current: '0.72.61' })).writes.length, 0);
assert.equal((await run({ remote: '0.72.59' })).writes.length, 0);
assert.equal((await run({ broken: true })).writes.length, 0);
assert.equal((await run({ typing: true })).writes.length, 0);
assert.equal((await run({ typing: true, silent: false })).updated, true, 'Explicit reconnect may update even if the old composer retained focus');
const fallback = await run({ offline: true });
assert.equal(fallback.fallback, 1);
assert.equal(fallback.writes.length, 3);
console.log('Updater checks passed: pinned release, manifest last, no downgrade, invalid bundle, typing, server fallback.');
