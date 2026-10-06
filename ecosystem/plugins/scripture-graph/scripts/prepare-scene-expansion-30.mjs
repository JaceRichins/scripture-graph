// Encode generated masters for the existing cache and include small true previews.
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const plugin = new URL('../', import.meta.url);
const output = new URL('../../../output/scene-expansion-30/', plugin);
const spec = JSON.parse(await fs.readFile(new URL('scripts/scene-expansion-30.json', plugin), 'utf8'));
const sources = JSON.parse(await fs.readFile(new URL('sources.json', output), 'utf8'));
const assets = new URL('src/assets/settings/expansion30/', plugin);
await fs.mkdir(new URL('offline/', assets), {recursive:true});
await fs.mkdir(new URL('originals/', output), {recursive:true});
let bytes = 0, previewBytes = 0;
for (const {id} of spec.scenes) {
  const source = sources.find(s => s.id === id);
  if (!source?.path) throw Error(`Missing generated master: ${id}`);
  const original = new URL(`originals/${id}.png`, output);
  await fs.copyFile(source.path, original);
  const full = await sharp(fileURLToPath(original)).jpeg({quality:88, mozjpeg:true}).toBuffer();
  const preview = await sharp(fileURLToPath(original)).resize(320,320,{fit:'inside'}).jpeg({quality:72, mozjpeg:true}).toBuffer();
  await fs.writeFile(new URL(`${id}.jpg`, assets), full);
  await fs.writeFile(new URL(`offline/${id}.jpg`, assets), preview);
  bytes += full.length; previewBytes += preview.length;
}
// Review sheet; originals retain their composition and resolution.
const layers=[];
for (const [i,{id,name}] of spec.scenes.entries()) {
  const x=(i%5)*320, y=Math.floor(i/5)*350;
  layers.push({input:await sharp(fileURLToPath(new URL(`${id}.jpg`,assets))).resize(304,304).toBuffer(),left:x+8,top:y+8});
  const label=Buffer.from(`<svg width="304" height="30"><text x="8" y="22" fill="#eee" font-family="Arial" font-size="16">${name.replaceAll('&','&amp;')}</text></svg>`);
  layers.push({input:label,left:x+8,top:y+314});
}
await sharp({create:{width:1600,height:2100,channels:3,background:'#132029'}}).composite(layers).jpeg({quality:88}).toFile(fileURLToPath(new URL('preview.jpg',output)));
console.log(JSON.stringify({scenes:spec.scenes.length,bytes,previewBytes}));
