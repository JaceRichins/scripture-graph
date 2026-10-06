import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function sceneRuntime() {
  const elements: any[] = [], images: any[] = [], classes = new Set<string>();
  const element = () => {
    const el: any = { style: {}, children: [], addClass() {}, setAttribute() {}, remove() {},
      createDiv() { const child = element(); el.children.push(child); return child; } };
    return el;
  };
  const document = { body: { dataset: {}, firstChild: null, insertBefore() {},
    addClass: (s: string) => classes.add(s), removeClass: (s: string) => classes.delete(s),
    createDiv: () => { const el = element(); elements.push(el); return el; } } };
  class Image {
    naturalWidth = 0; complete = false; src = ''; onload: any; onerror: any;
    constructor() { images.push(this); }
  }
  const exports: any = {};
  const code = ts.transpileModule(readFileSync(new URL('../../plugins/scripture-graph/src/study/scenes.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, Image, document, window: { innerWidth: 390, innerHeight: 844 }, setTimeout, clearTimeout,
    require: (name: string) => name === './scenePhotos' ? { SCENE_PHOTOS: { study: 'data:study', waters: 'data:waters' } }
      : name === './sceneCache' ? { wideScene: () => false } : {},
  });
  return { ...exports, elements, images, classes };
}

it('starts a fresh matching-mode Library with bundled artwork while preserving explicit off and valid choices', () => {
  const { configuredSceneId, SceneManager, elements, classes } = sceneRuntime();
  expect(configuredSceneId('match')).toBe('study');
  expect(configuredSceneId('match', 'none')).toBe('study');
  expect(configuredSceneId('match', 'retired-scene')).toBe('study');
  expect(configuredSceneId('match', 'waters')).toBe('waters');
  expect(configuredSceneId('none', 'waters')).toBe('none');
  expect(configuredSceneId('auto')).toBe('auto');
  const manager = new SceneManager();
  manager.apply(configuredSceneId('match'));
  expect(classes.has('sg-scene-on')).toBe(true);
  expect(elements[0].children[0].style.backgroundImage).toBe('url("data:study")');
});

it('keeps the offline photo when a cached image cannot decode, and replaces it only after successful load', async () => {
  const { SceneManager, elements, images } = sceneRuntime();
  const manager = new SceneManager();
  manager.cache = { get: async () => 'app:downloaded' };
  manager.apply('study');
  await Promise.resolve();
  const art = elements[0].children[0];
  expect(art.style.backgroundImage).toBe('url("data:study")');
  images[0].onerror(); await Promise.resolve(); await Promise.resolve();
  expect(art.style.backgroundImage).toBe('url("data:study")');
  manager.refresh(); await Promise.resolve();
  images[1].naturalWidth = 1080; images[1].onload(); await Promise.resolve(); await Promise.resolve();
  expect(elements[1].children[0].style.backgroundImage).toBe('url("app:downloaded")');
});

it('does not restore a photo after the reader turns backgrounds off during an image load', async () => {
  const { SceneManager, images, classes, elements } = sceneRuntime();
  const manager = new SceneManager();
  manager.cache = { get: async () => 'app:late' };
  manager.apply('study'); await Promise.resolve();
  manager.apply('none');
  images[0].naturalWidth = 1080; images[0].onload(); await Promise.resolve(); await Promise.resolve();
  expect(classes.has('sg-scene-on')).toBe(false);
  expect(elements[0].children[0].style.backgroundImage).toBe('url("data:study")');
});
