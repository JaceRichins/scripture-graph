import fs from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const themes = process.argv.includes('--themes');
const bom = process.argv.includes('--bom');
const groups = bom ? [
  ['events', [['tree-of-life','Lehi’s Tree of Life'],['liahona','The Liahona'],['nephi-ship','Nephi Builds a Ship'],['ocean-voyage','The Ocean Voyage'],['enos-prayer','Enos Prays']]],
  ['events', [['king-benjamin','King Benjamin’s Address'],['abinadi-testimony','Abinadi’s Testimony'],['ammon-flocks','Ammon at Sebus'],['title-liberty','The Title of Liberty'],['stripling-warriors','The Stripling Warriors']]],
  ['events', [['samuel-wall','Samuel on the Wall'],['brother-jared','The Brother of Jared'],['jaredite-barges','The Jaredite Barges'],['christ-children','Christ Blesses the Children'],['moroni-record','Moroni Preserves the Record']]],
] : themes ? [
  ['settings', [['shepherd-pasture','Shepherd’s Pasture'],['village-well','Village Well'],['potters-workshop','Potter’s Workshop'],['mountain-refuge','Mountain Refuge']]],
  ['settings', [['desert-oasis','Desert Oasis'],['upper-room','Upper Room'],['cedar-forest','Cedar Forest'],['pilgrim-road','Pilgrim Road']]],
] : [
  ['settings', [['vineyard','Hillside Vineyard'],['fishing-village','Fishing Village'],['wilderness-path','Wilderness Path'],['ancient-synagogue','Ancient Synagogue']]],
  ['events', [['burning-bush','The Burning Bush'],['jordan-baptism','Baptism in the Jordan'],['feeding-multitude','Feeding the Multitude'],['waters-mormon','Waters of Mormon']]],
];
const layers = [];
for (const [groupIndex, [folder, scenes]] of groups.entries()) {
  for (const [index, [id, name]] of scenes.entries()) {
    const left = index * 480 + 24;
    const top = groupIndex * 740 + 90;
    for (const [variant, width, height, offset] of [['portrait',200,300,0],['wide',420,280,330]]) {
      const input = new URL(`src/assets/${folder}/${id}-${variant}.jpg`, root);
      const buffer = await sharp(await fs.readFile(input)).resize(width,height,{fit:'cover'}).toBuffer();
      layers.push({ input: buffer, left, top: top + offset });
    }
    const label = Buffer.from(`<svg width="440" height="40"><text x="0" y="28" fill="#eef2ee" font-family="Arial" font-size="24">${name}</text></svg>`);
    layers.push({input:label,left,top:top+620});
  }
}
layers.push({input:Buffer.from(`<svg width="1900" height="60"><text x="24" y="42" fill="#eef2ee" font-family="Arial" font-size="32">Scripture Graph — ${bom ? '30 Book of Mormon event' : '16 new'} photos · phone + desktop</text></svg>`),left:0,top:0});
const destination = new URL(`scene-release/${bom ? 'bom-events-preview' : themes ? 'theme-expansion-preview' : 'scene-expansion-preview'}.jpg`,root);
await sharp({create:{width:bom?2400:1920,height:groups.length*740+30,channels:3,background:'#101820'}}).composite(layers).jpeg({quality:86}).toFile(fileURLToPath(destination));
console.log(destination.href);
