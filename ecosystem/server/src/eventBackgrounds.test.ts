import { afterEach, expect, it, vi } from 'vitest';
import { eventBackgrounds, filterBackgrounds, renderEventBackgrounds } from '../../plugins/scripture-graph/src/study/eventBackgrounds';
import { SCENE_OVERRIDES } from '../../plugins/scripture-graph/src/study/presence';

const rows = eventBackgrounds({ 'tree-of-life': 'Lehi’s Tree of Life' });
afterEach(() => vi.unstubAllGlobals());

it('includes every assigned chapter in scripture order without expanding book-wide defaults', () => {
  expect(rows.map(r => r.slug).sort()).toEqual(Object.keys(SCENE_OVERRIDES).filter(k => /-\d+$/.test(k)).sort());
  expect(new Set(rows.map(r => r.slug)).size).toBe(rows.length);
  expect(rows[0]?.chapter).toBe('Genesis 1');
  expect(rows.filter(r => r.scene === 'tree-of-life').map(r => r.chapter)).toEqual(['1 Nephi 8', '1 Nephi 11']);
  expect(rows.some(r => r.slug === 'ex-1')).toBe(false);
  expect(rows.some(r => r.slug === 'dc-121')).toBe(true);
  expect(filterBackgrounds(rows, 'tree life').map(r => r.slug)).toEqual(['1ne-8', '1ne-11']);
  // Search covers event names as well as chapter names: Alma's visitation is in Mosiah.
  expect(filterBackgrounds(rows, 'Mormon Alma').map(r => r.slug)).toContain('mosiah-27');
  expect(filterBackgrounds(rows, 'Mormon Alma').map(r => r.slug)).toContain('alma-14');
  expect(filterBackgrounds(rows, 'Mormon Alma').every(r => r.volume === 'Book of Mormon')).toBe(true);
  expect(filterBackgrounds(rows, 'Mormon night without darkness').map(r => r.slug)).toEqual(['3ne-1']);
});

class Element {
  children: Element[] = []; value = ''; disabled = false; attributes: Record<string,string> = {};
  onclick?: () => void; oninput?: () => void; onerror?: () => void;
  constructor(public tag = '', public text = '') {}
  createEl(tag: string, opts: any = {}) { const child = new Element(tag, opts.text ?? ''); child.attributes = opts.attr ?? {}; this.children.push(child); return child; }
  createDiv(opts = {}) { return this.createEl('div', opts); }
  createSpan(opts = {}) { return this.createEl('span', opts); }
  empty() { this.children = []; }
  setText(text: string) { this.text = text; }
  remove() {} scrollIntoView() {}
  all(): Element[] { return [this, ...this.children.flatMap(c => c.all())]; }
}
const drain = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

it('loads only visible previews, keeps chapter navigation separate, and cancels departed pages', async () => {
  const observers: any[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    targets: Element[] = []; disconnected = false;
    constructor(public callback: (entries: any[]) => void) { observers.push(this); }
    observe(target: Element) { this.targets.push(target); }
    unobserve() {} disconnect() { this.disconnected = true; }
  });
  const c = new Element(), photo = vi.fn(async () => 'cache://exact-art'), open = vi.fn(), preview = vi.fn();
  const cleanup = renderEventBackgrounds(c as any, rows, '', 0, { query() {}, page() {}, photo, open, preview });
  expect(photo).not.toHaveBeenCalled();
  expect(observers[0].targets).toHaveLength(12);
  observers[0].callback([{ target: observers[0].targets[0], isIntersecting: true }]);
  await drain();
  expect(photo).toHaveBeenCalledTimes(1); expect(photo).toHaveBeenCalledWith('creation', false);
  expect(c.all().find(e => e.tag === 'img')?.attributes.src).toBe('cache://exact-art');
  observers[0].targets[0].onclick(); expect(preview).toHaveBeenCalledWith(rows[0]); expect(open).not.toHaveBeenCalled();
  c.all().find(e => e.text === 'Open chapter')!.onclick!(); expect(open).toHaveBeenCalledWith('Genesis 1');
  c.all().find(e => e.text === 'Next')!.onclick!();
  expect(observers[0].disconnected).toBe(true); expect(photo).toHaveBeenCalledTimes(1);
  const input = c.all().find(e => e.tag === 'input')!; input.value = 'tree life'; input.oninput!();
  expect(c.all().find(e => e.tag === 'input')).toBe(input);
  expect(observers.at(-1).targets).toHaveLength(2);
  cleanup();
  observers.at(-1).callback([{ target: observers.at(-1).targets[0], isIntersecting: true }]);
  expect(photo).toHaveBeenCalledTimes(1);
});

it('shows unavailable artwork honestly and can retry without hiding the chapter', async () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const c = new Element(), photo = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('cache://recovered');
  renderEventBackgrounds(c as any, rows.slice(0, 1), '', 0, { query() {}, page() {}, photo, open() {}, preview() {} });
  await drain(); expect(c.all().some(e => e.text.includes('Photo unavailable'))).toBe(true);
  expect(c.all().some(e => e.text === 'Open chapter')).toBe(true);
  c.all().find(e => e.attributes['aria-label']?.startsWith('Preview'))!.onclick!(); await drain();
  expect(c.all().find(e => e.tag === 'img')?.attributes.src).toBe('cache://recovered');
});
