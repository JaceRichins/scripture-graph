import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const {outputFiles}=await build({entryPoints:['src/study/atlas/settlement-distance.ts'],bundle:true,write:false,format:'esm'});
const {settlementDistances}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const base={centerKm:100,departureRadiusKm:2,arrivalRadiusKm:5,centerAllowanceKm:0,routeFactor:1.5,kmPerDay:25};
const rows=settlementDistances(base);
assert.deepEqual(rows.map(r=>r.straightKm),[[100,100],[93,93],[93,107],[103,103]]);
assert.equal(rows[3].straightKm[0]-rows[1].straightKm[0],10,'Arrival traverse adds diameter, not radius');
assert.deepEqual(settlementDistances({...base,centerAllowanceKm:10}).map(r=>r.straightKm),[[90,110],[83,103],[83,117],[93,113]]);
assert.deepEqual(settlementDistances({...base,departureRadiusKm:0,arrivalRadiusKm:0}).map(r=>r.straightKm),Array(4).fill([100,100]));
const overlap=settlementDistances({...base,centerKm:4});
assert.deepEqual(overlap[2].straightKm,[0,11]);assert.equal(overlap[3].straightKm,null,'No disjoint-city traverse for overlapping disks');
assert.equal(settlementDistances({...base,centerKm:20,centerAllowanceKm:15})[3].straightKm,null,'Location allowance can invalidate a crossing scenario');
for(const patch of [{arrivalRadiusKm:-1},{routeFactor:.5},{kmPerDay:0},{centerKm:NaN},{departureRadiusKm:Infinity}])assert.throws(()=>settlementDistances({...base,...patch}),RangeError);
const audit=JSON.parse(readFileSync('../../../docs/atlas-research/settlement-distances.json','utf8'));
for(const scenario of audit.scenarios)for(const row of settlementDistances(scenario)){
  const expected=scenario.cases[row.id];
  if(!expected){assert.equal(row.straightKm,null);continue;}
  for(const [field,other] of [['straightKm','directKm'],['routeKm','routeKm'],['days','days']])
    for(let i=0;i<2;i++)assert.ok(Math.abs(row[field][i]-expected[other][i])<.0001,`${scenario.modelId}/${row.id}/${field}`);
}
assert.ok(existsSync(resolve('../../../Scripture Graph/AI Library/91 Maps/City boundaries and travel distances.md')));
const json=JSON.parse(readFileSync('src/study/atlas/reconstruction.json','utf8'));
assert.ok(json.models.every(m=>m.points.some(p=>p.id==='nephi-city')&&m.points.some(p=>p.id==='zarahemla')));
console.log('Settlement checks passed: asymmetric edges, diameter crossing, independent location allowances, zero extents, overlap, invalid input, 16 audit scenarios, and research destination.');
