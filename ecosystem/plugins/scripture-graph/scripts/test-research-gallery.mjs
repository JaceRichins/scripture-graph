import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const read=name=>JSON.parse(readFileSync('src/study/atlas/'+name+'.json','utf8'));
const photos=read('research-photos'),figures=read('research-figures');
const ids=new Set([...read('atlas').points,...read('destruction').markers].map(p=>p.id));
assert.ok(photos.length>=8);
assert.equal(new Set(photos.map(p=>p.id)).size,photos.length);
for(const p of photos){
  for(const key of ['id','title','site','category','evidenceType','caption','support','limit','source','author','date','license','licenseUrl','research','researchTitle','eventDate','changes'])assert.ok(typeof p[key]==='string'&&p[key].trim(),p.id+': '+key);
  assert.ok(p.image.startsWith('data:image/jpeg;base64,'));
  const bytes=Buffer.from(p.image.split(',')[1],'base64');assert.deepEqual([...bytes.subarray(0,2)],[255,216]);assert.ok(bytes.length>10000);
  for(const id of p.places)assert.ok(ids.has(id),'Unknown photo place: '+id);
  if(p.mapPlace)assert.ok(ids.has(p.mapPlace));
  for(const url of [p.source,p.research,p.licenseUrl,...(p.moreResearch??[]).map(r=>r.url)])assert.equal(new URL(url).protocol,'https:');
}
assert.equal(figures.length,3);
for(const f of figures){assert.ok(!f.image,'Unlicensed research figures must stay external');assert.ok(f.credit&&f.caption&&f.limit&&f.date);for(const url of [f.source,f.figureUrl].filter(Boolean))assert.equal(new URL(url).protocol,'https:');}
assert.ok(photos.find(p=>p.id==='ilopango-caldera-2019').eventDate.includes('431'));
assert.ok(photos.filter(p=>p.id.startsWith('ceren-')).every(p=>p.eventDate.includes('later analogue')));
assert.ok(photos.find(p=>p.id==='atitlan-landscape').evidenceType.includes('underwater ruins are not visible'));
assert.ok(photos.find(p=>p.id==='tetimpa-macias-1995').mapLabel.includes('source volcano'));
assert.ok(existsSync(resolve('../../../Scripture Graph/AI Library/91 Maps/Photographs and field evidence.md')));
console.log(`Research gallery passed: ${photos.length} offline photographs, provenance and source roles, map destinations, chronology distinctions, and ${figures.length} external-only research figures.`);
