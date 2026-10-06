import fs from 'node:fs';
const ids=['sunrise','waters','mount','garden','fields','storm','temple','city','warcamp','prison','desert','starlight','candle','grove','riverbank','shore','olive','study'];
const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const cards=ids.map(id=>{
 const path=id==='waters'?'../src/assets/still-waters.jpg':`../src/assets/scenes/${id}.jpg`;
 if(!fs.existsSync(new URL('../harness-dist/'+path,import.meta.url))) throw Error('Missing '+id);
 return `<figure><div class="frame"><img src="${path}"><div class="sample"><h2>${id}</h2><p>The Lord is my shepherd; I shall not want.</p><p>He leadeth me beside the still waters.</p><p>He restoreth my soul.</p></div></div><figcaption>${id}</figcaption></figure>`;
}).join('');
fs.writeFileSync(new URL('../harness-dist/photo-scenes.html',import.meta.url),`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:18px;background:#10151d;color:#f3f6f5;font:16px system-ui}main{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}figure{margin:0}.frame{height:450px;position:relative;overflow:hidden;border-radius:12px}img{width:100%;height:100%;object-fit:cover}.frame:after{content:'';position:absolute;inset:0;background:linear-gradient(rgba(5,15,24,.66),rgba(5,15,24,.60) 38%,rgba(5,15,24,.62) 72%,rgba(5,15,24,.68))}.sample{position:absolute;inset:0;z-index:1;padding:28px 20px;color:#f3f6f5;font:18px/1.7 Georgia;text-shadow:0 1px 3px #0009}.sample h2{font:600 22px system-ui;text-transform:capitalize;color:white}.sample p{margin:28px 0}figcaption{padding:8px;text-transform:capitalize}</style><main>${cards}</main>`);
console.log('All 18 photo assets present; reading gallery generated.');
