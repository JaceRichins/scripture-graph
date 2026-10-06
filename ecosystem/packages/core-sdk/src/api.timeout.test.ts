import { afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from './api';

afterEach(() => vi.useRealTimers());
it.each([502,503,504,530])('recovers AI status through a known alternative after gateway HTTP %s', async status => {
  const fetch=vi.fn(async(url:string)=>({status:url.startsWith('https://current.invalid')?status:200,json:async()=>({available:true,turns:[]})}));
  const api=new ApiClient('https://current.invalid',fetch);api.setCandidates(['https://fallback.invalid']);
  expect((await api.askStatus()).available).toBe(true);
  expect(api.baseUrl).toBe('https://fallback.invalid');
});
it('does not treat an authentication failure as a failed tunnel', async()=>{
  const fetch=vi.fn(async()=>({status:401,json:async()=>({error:'Sign in again'})}));
  const api=new ApiClient('https://current.invalid',fetch);api.setCandidates(['https://fallback.invalid']);
  await expect(api.askStatus()).rejects.toThrow('Sign in again');
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(['manifest', 'batch'] as const)('lets a slow cellular %s finish beyond discovery timeout', async kind => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, 12_000));
    return { status: 200, json: async () => ({ files: [], version: 'v1' }) };
  });
  const api = new ApiClient('https://current.invalid', fetch);
  api.setCandidates(['https://fallback.invalid']);
  const result = kind === 'manifest' ? api.vaultManifest() : api.vaultBatch(['Page.md']);
  await vi.advanceTimersByTimeAsync(12_000);
  expect((await result).files).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('still fails over quickly for discovery', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async (url: string) => {
    if (url.startsWith('https://current.invalid')) return new Promise<never>(() => {});
    return { status: 200, json: async () => ({ urls: [] }) };
  });
  const api = new ApiClient('https://current.invalid', fetch);
  api.setCandidates(['https://fallback.invalid']);
  const result = api.where();
  await vi.advanceTimersByTimeAsync(6_000);
  await result;
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(api.baseUrl).toBe('https://fallback.invalid');
});
