import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const {outputFiles}=await build({entryPoints:['src/study/atlas/math.ts'],bundle:true,write:false,format:'esm'});
const {distanceKm,projection,travelKm}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
assert.equal(distanceKm([0,0],[0,0]),0);
assert.ok(Math.abs(distanceKm([0,0],[0,1])-111.195)<.01);
assert.ok(Math.abs(distanceKm([0,60],[1,60])-55.597)<.01);
assert.deepEqual(projection([30,20,40,40])([35,30]),[500,310]);
assert.equal(travelKm(1.5,25),37.5);
const data=JSON.parse(readFileSync('src/study/atlas/atlas.json','utf8'));
const vault=resolve('../../../Scripture Graph');
assert.equal(new Set(data.points.map(p=>p.id)).size,data.points.length,'unique marker ids');
assert.equal(new Set(data.points.map(p=>p.path)).size,data.points.length,'one distinct page per marker');
for(const p of data.points){assert.ok(existsSync(resolve(vault,p.path)),p.path);assert.ok(readFileSync(resolve(vault,p.path),'utf8').includes('SG:BEGIN atlas-links'),p.name+' backlink');if(p.world==='bom')assert.ok(['relative','unplaced'].includes(p.status));}
for(const f of readdirSync(resolve(vault,'AI Library/04 Places')).filter(f=>f.endsWith('.md')&&f!=='Places.md'))assert.ok(data.points.some(p=>p.path==='AI Library/04 Places/'+f),'place missing from atlas: '+f);
for(const r of data.routes){assert.ok(data.points.some(p=>p.id===r.a));assert.ok(data.points.some(p=>p.id===r.b));assert.ok(r.days>0);}
assert.equal(data.routes.slice(0,3).reduce((s,r)=>s+r.days,0),21);
for(const c of data.candidates)if(c.crossing)assert.ok(Math.abs(distanceKm(...c.crossing)-c.km)<.06,c.name);
assert.equal(data.points.find(p=>p.name==='Cumorah').xy,null);
assert.ok(data.points.find(p=>p.name==='Hill Cumorah (New York)').xy);
console.log(`Atlas checks passed: math, ${data.points.length} unique page links/backlinks, existing place coverage, travel stages, candidate distances, and Cumorah distinction.`);
const {models}=JSON.parse(readFileSync('src/study/atlas/reconstruction.json','utf8'));
for(const m of models){
  assert.equal(new Set(m.points.map(p=>p.id)).size,m.points.length);
  for(const p of m.points){
    assert.ok(data.points.some(d=>d.id===p.id),`missing linked place ${p.id}`);
    assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90);
    assert.equal(p.confidence,'proposed'); assert.ok(p.uncertaintyKm>0); assert.ok(p.refs.length&&p.refs.every(r=>r.startsWith('https://')));
  }
  assert.ok(m.rivers.length&&m.rivers[0].coordinates.every(line=>line.length>1));
}
assert.ok(distanceKm(...models.map(m=>{const p=m.points.find(p=>p.id==='zarahemla');return[p.lon,p.lat];}))>190,'capital proposals remain distinct');
assert.ok(!models[1].points.some(p=>p.id==='moroni-city'),'do not copy Grijalva cities into Usumacinta model');
const relief=JSON.parse(readFileSync('src/study/atlas/relief.json','utf8'));
for(const name of ['old','new','bom','holy']){
 const r=relief[name];assert.equal(r.bounds.length,4);assert.ok(r.bounds[0]<r.bounds[2]&&r.bounds[1]<r.bounds[3]);
 const bytes=Buffer.from(r.url.split(',')[1],'base64');assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length>10000);
}
const evidence=JSON.parse(readFileSync('src/study/atlas/destruction.json','utf8'));
for(const p of evidence.markers){assert.ok(existsSync(resolve(vault,p.path)),p.path);assert.ok(p.sourceUrls.length);assert.ok(p.dateRange&&p.coordinateMeaning);}
assert.ok(evidence.markers.some(p=>p.dateRange.includes('431')));
assert.ok(evidence.markers.some(p=>p.dateRange.includes('40')));
console.log('Reconstruction checks passed: sourced anchors, independent river variants, offline terrain, linked physical evidence, chronology.');
