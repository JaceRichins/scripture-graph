import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const c=vm.createContext({exports:{}});
vm.runInContext(ts.transpileModule(fs.readFileSync(new URL('../src/study/sceneArt.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,c);
const ids=['sunrise','waters','mount','garden','fields','storm','temple','city','warcamp','prison','desert','starlight','candle','grove','riverbank','shore','olive','study'];
const out=new URL('../harness-dist/scenes-gallery.html',import.meta.url);
fs.writeFileSync(out,`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0d121a;color:#eee;font:16px system-ui;padding:18px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}figure{margin:0}img{width:100%;height:450px;object-fit:cover;border-radius:12px}figcaption{padding:8px 0;text-transform:capitalize}</style><main>${ids.map(id=>`<figure><img src="data:image/svg+xml,${encodeURIComponent(c.exports.sceneArtwork(id))}"><figcaption>${id}</figcaption></figure>`).join('')}</main>`);
for(const id of ids){const svg=c.exports.sceneArtwork(id);if(svg.includes('NaN')||svg.includes('undefined'))throw Error(id);}
console.log(out.pathname);

