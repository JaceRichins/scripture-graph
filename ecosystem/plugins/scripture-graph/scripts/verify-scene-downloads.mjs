import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const catalog = JSON.parse(await fs.readFile(new URL('../scene-release/catalog.json',import.meta.url),'utf8'));
const selected = new Set(process.argv.slice(2));
let checked = 0;
for (const [id,variants] of Object.entries(catalog)) {
  if (selected.size && !selected.has(id)) continue;
  for (const [variant,asset] of Object.entries(variants)) {
    const response = await fetch(asset.url,{signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw Error(`${id}/${variant}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    if (bytes.length !== asset.bytes || hash !== asset.sha256) throw Error(`${id}/${variant}: integrity mismatch`);
    console.log(`Verified ${id}/${variant}: ${bytes.length} bytes`);
    checked++;
  }
}
if (!checked) throw Error('No images matched');
console.log(`All ${checked} public downloads match catalog size and SHA256.`);
