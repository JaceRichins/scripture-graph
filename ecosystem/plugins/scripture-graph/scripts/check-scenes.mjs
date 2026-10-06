import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';
function load(file) {
  const context = vm.createContext({ exports: {}, require: () => ({ sceneArtworkUrl: () => '' }) });
  vm.runInContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return context.exports;
}
// Noncanonical page matching stays text-sensitive; the canonical assignment
// table and gallery consistency are covered in photoGallery.test.ts.
const { matchPageScene: matchScene, SCENE_OVERRIDES } = load('../src/study/presence.ts');
const { SCENES } = load('../src/study/scenes.ts');
const bomEvents = {
  'tree-of-life': ['Lehi’s dream', '1ne-8'],
  liahona: ['The Liahona', '1ne-16'],
  'nephi-ship': ['Nephi builds a ship', '1ne-17'],
  'ocean-voyage': ['Voyage to the promised land', '1ne-18'],
  'enos-prayer': ['Enos prays', 'enos-1'],
  'king-benjamin': ['King Benjamin’s address', 'mosiah-2'],
  'abinadi-testimony': ['Abinadi’s testimony', 'mosiah-13'],
  'ammon-flocks': ['Ammon at Sebus', 'alma-17'],
  'title-liberty': ['The title of liberty', 'alma-46'],
  'stripling-warriors': ['The stripling warriors', 'alma-56'],
  'samuel-wall': ['Samuel the Lamanite', 'hel-13'],
  'brother-jared': ['The brother of Jared', 'ether-3'],
  'jaredite-barges': ['The Jaredite barges', 'ether-6'],
  'christ-children': ['Christ blesses the Nephite children', '3ne-17'],
  'moroni-record': ['Moroni preserves the record', 'moro-10'],
};
for (const [id,[title,slug]] of Object.entries(bomEvents)) {
  assert.equal(matchScene(`# ${title}`),id,`Event title: ${title}`);
  assert.equal(matchScene('battle water forest '.repeat(20),slug),id,`Event chapter: ${slug}`);
}
assert.equal(matchScene('# Lesson preparation\n[[Abinadi]] [[The Liahona]]'), 'study');
assert.notEqual(matchScene('# Jesus blesses the children', 'mark-10'), 'christ-children');
assert.notEqual(matchScene('# The tree of life in Eden', 'gen-2'), 'tree-of-life');
assert.notEqual(matchScene("# Samuel's prophecy\nThe Lord spoke to Samuel about Eli.", '1sam-3'), 'samuel-wall');
assert.notEqual(matchScene('# The iron rod\nHe shall rule them with an iron rod.', 'rev-2'), 'tree-of-life');
assert.equal(matchScene('battle '.repeat(50), 'ps-23'), 'waters');
assert.equal(matchScene('# Family lesson\n## Preparation\nDiscussion and teaching plan. [[Reference - battle]]'), 'study');
assert.equal(matchScene('# Baptism in the Jordan\nThe riverbank and river.'), 'riverbank');
assert.equal(matchScene('# Fishing on Galilee\nThe fishermen brought their boat to shore.'), 'shore');
assert.equal(matchScene('# Olive trees\nAn oliveyard on the hills.'), 'olive');
assert.equal(matchScene('Nothing identifies a setting here.'), 'study');
assert.equal(matchScene('---\nkeywords: battle battle battle\n---\n# Lesson preparation'), 'study');
for (const [text, scene] of [
  ['# The Burning Bush\nMoses approaches holy ground.', 'burning-bush'],
  ['# Baptism of Jesus\nJesus was baptized in the Jordan.', 'jordan-baptism'],
  ['# Feeding the Multitude\nFive loaves and two fishes.', 'feeding-multitude'],
  ['# Waters of Mormon\nAlma baptized his people.', 'waters-mormon'],
  ['# The Vineyard\nGrapes ripen beside the winepress.', 'vineyard'],
  ['# Fishing Village\nA quiet morning in Capernaum.', 'fishing-village'],
  ['# Wilderness Path\nA path through the wilderness.', 'wilderness-path'],
  ['# Ancient Synagogue\nThe Torah scroll is ready.', 'ancient-synagogue'],
  ['# Shepherd’s Pasture\nGrazing sheep rest in green pastures.', 'shepherd-pasture'],
  ['# Village Well\nDrawing water from the well.', 'village-well'],
  ['# Potter’s Workshop\nShaping clay on the potter’s wheel.', 'potters-workshop'],
  ['# Mountain Refuge\nShelter in the mountains.', 'mountain-refuge'],
  ['# Desert Oasis\nRest at an oasis.', 'desert-oasis'],
  ['# The Upper Room\nGather in the upper chamber.', 'upper-room'],
  ['# Cedar Forest\nAmong the cedars of Lebanon.', 'cedar-forest'],
  ['# Pilgrim Road\nA pilgrimage road stretches ahead.', 'pilgrim-road'],
]) assert.equal(matchScene(text), scene, text);
for (const [slug, scene] of Object.entries({
  'ex-3':'burning-bush', 'matt-3':'jordan-baptism', 'luke-3':'jordan-baptism',
  'matt-14':'feeding-multitude', 'mark-6':'feeding-multitude',
  'luke-9':'feeding-multitude', 'john-6':'feeding-multitude', 'mosiah-18':'waters-mormon',
  'john-4':'village-well', 'jer-18':'potters-workshop',
})) assert.equal(matchScene('battle '.repeat(50), slug), scene, slug);
// A general baptism lesson is not automatically Jesus' baptism, and chapters
// with several settings still respond to the actual subject being read.
assert.equal(matchScene('# Baptism\nOur family prepares for baptism.'), 'riverbank');
assert.equal(matchScene('# Jesus was baptized\nBaptism of Jesus.', 'mark-1'), 'jordan-baptism');
assert.equal(matchScene('# Fishing on Galilee\nFishermen and their boat.', 'mark-1'), 'shore');
assert.equal(matchScene('# Baptism of Jesus\nJohn bears witness.', 'john-1'), 'jordan-baptism');
assert.equal(matchScene('# Follow me\nFishermen brought a boat to shore.', 'john-1'), 'shore');
assert.equal(matchScene('# Lesson preparation\n[[Waters of Mormon]] https://example.test/burning-bush'), 'study');
assert.equal(matchScene('# Baptism of Jesus\nThe village well is nearby.'), 'jordan-baptism');
assert.equal(matchScene('# The Empty Tomb\nA pilgrim road passes the garden.'), 'empty-tomb');
assert.equal(matchScene('# Gethsemane\nLeaving the upper room.'), 'gethsemane');
assert.equal(matchScene('# Family lesson\nAll is well. Our refuge and our road ahead.'), 'study');
assert.equal(matchScene('# Lesson preparation\n[[Village Well]] [[Cedar Forest]]'), 'study');
assert.equal(matchScene('green pastures sheepfold grazing sheep', 'ps-23'), 'waters');
assert.equal(matchScene('road to Emmaus', 'luke-24'), 'emmaus-road');
for (const id of Object.values(SCENE_OVERRIDES)) assert(SCENES.some(scene => scene.id === id));
assert.equal(new Set(SCENES.map(scene => scene.id)).size, SCENES.length);
const {SCENE_CATALOG}=load('../src/study/sceneCatalog.ts');
for (const id of Object.keys(bomEvents)) assert(SCENE_CATALOG[id]?.wide, `Missing Book of Mormon desktop photo: ${id}`);
for (const { id } of SCENES) {
  const row = SCENE_CATALOG[id];
  assert(row?.portrait, `Missing photographic scene: ${id}`);
  for (const [variant, entry] of Object.entries(row)) {
    const bytes = fs.readFileSync(new URL('../scene-release/' + entry.file, import.meta.url));
    assert(bytes.length > 10000 && bytes[0] === 255 && bytes[1] === 216, `Invalid image: ${id}/${variant}`);
    assert.equal(bytes.length, entry.bytes, `Wrong size: ${id}/${variant}`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `Wrong checksum: ${id}/${variant}`);
  }
}
for (const id of ['burning-bush','jordan-baptism','feeding-multitude','waters-mormon','vineyard','fishing-village','wilderness-path','ancient-synagogue','shepherd-pasture','village-well','potters-workshop','mountain-refuge','desert-oasis','upper-room','cedar-forest','pilgrim-road']) {
  assert(SCENE_CATALOG[id].wide, `Missing desktop photograph: ${id}`);
}
assert.equal(matchScene('other words','ex-14'),'exodus');
assert.equal(matchScene('other words','john-20'),'empty-tomb');
for (const [slug, scene] of Object.entries({
  '3ne-8': 'three-days-darkness', '3ne-9': 'three-days-darkness', '3ne-10': 'three-days-darkness',
  '3ne-11': 'nephites', '3ne-18': 'nephite-sacrament', 'alma-24': 'buried-weapons', 'jsh-1': 'first-vision',
  'mosiah-27': 'alma-angel', 'alma-14': 'prison-deliverance',
  'hel-5': 'nephi-lehi-fire', '3ne-1': 'night-without-darkness',
})) {
  assert.equal(matchScene('storm temple sunrise battle '.repeat(50), slug), scene, slug);
  assert(SCENE_CATALOG[scene].wide, `Missing landscape: ${scene}`);
  const offline = fs.readFileSync(new URL(`../src/assets/events/offline/${scene}.jpg`, import.meta.url));
  assert(offline.length > 2000 && offline.length < 100000, `Invalid offline preview: ${scene}`);
}
console.log(`Scene checks passed: ${SCENES.length} unique scenes, supported overrides, page subjects, and metadata/reference exclusions.`);
