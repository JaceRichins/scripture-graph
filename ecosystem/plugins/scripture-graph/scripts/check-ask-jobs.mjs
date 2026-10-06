import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/ai/aiService.ts', import.meta.url), 'utf8');
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const context = vm.createContext({ exports: {}, require: () => ({ ApiError, usesTeam: () => false }),   // usesTeam: this check is about job resumption, not team routing
  crypto: { randomUUID: () => 'test-stable-request-id' }, window: { setTimeout: callback => { queueMicrotask(callback); } } });
vm.runInContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
let saved = null, starts = 0, polls = 0;
const ids = [], progress = [];
const service = Object.create(context.exports.AiService.prototype);
service.s = {
  device: { userId: "check-user" },   // askServer ties a job to the account that started it
  store: { get: async () => saved, put: async (_key, value) => { saved = value; } },
  api: {
    startAskJob: async id => { ids.push(id); starts++; if (starts === 1) throw new Error('Connection lost after acceptance'); return { id, status: 'working' }; },
    askJob: async id => { ids.push(id); polls++; if (polls === 1) throw new Error('Cellular connection lost'); return { id, status: 'finished', result: { ok: true, answer: 'Finished lesson', actions: [{ do: 'lesson' }] } }; },
  },
};
const result = await service.askServer('Make a lesson', null, { onProgress: value => progress.push(value) });
assert.equal(result.text, 'Finished lesson');
assert.equal(new Set(ids).size, 1, 'Lost responses must reuse the original job ID');
assert.equal(starts, 2);
assert.equal(polls, 2);
assert.equal(saved, null);
assert.ok(progress.some(value => value.includes('Reconnecting')));
saved = { id: 'saved-before-app-restart', question: 'Make a lesson', body: { question: 'Make a lesson' } };
ids.length = 0;
await service.askServer('Make a lesson', null);
assert.ok(ids.every(id => id === 'saved-before-app-restart'));
service.s.api.startAskJob = async () => ({ status: 'failed', result: { error: 'Assistant stopped' } });
await assert.rejects(() => service.askServer('Another lesson', null), /Assistant stopped/);
assert.equal(saved, null);
console.log('Ask job client checks passed: lost submission response, dropped polling connection, restart resume, terminal failure.');
