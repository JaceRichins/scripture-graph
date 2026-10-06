import { build } from 'esbuild';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
const out='../../../output/atlas-preview';
// Explicit review fixtures; these variables emulate the native host's insets.
// Default browser preview remains unchanged. No fixture code ships in the plugin.
const safeAreaFixture=`const fixture=new URLSearchParams(location.search).get('safe-area');const insets=fixture==='portrait'?[59,0,34,0]:fixture==='landscape'?[0,59,21,59]:null;if(insets){['top','right','bottom','left'].forEach((edge,i)=>document.documentElement.style.setProperty('--safe-area-inset-'+edge,insets[i]+'px'));document.documentElement.dataset.safeAreaFixture=fixture;}`;
mkdirSync(out,{recursive:true});
await build({stdin:{contents:`import {renderAtlas} from './src/study/atlas/maps'; renderAtlas(document.getElementById('atlas'),path=>{document.getElementById('opened').textContent='Opened: '+path;window.__atlasOpened=path;});`,resolveDir:process.cwd()},bundle:true,format:'iife',outfile:out+'/atlas.js'});
copyFileSync('src/study/atlas/atlas.css',out+'/atlas.css');
writeFileSync(out+'/index.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Scripture Atlas — review</title><link rel="stylesheet" href="atlas.css"><style>body{margin:0;background:linear-gradient(140deg,#121f2b,#263b42);font:16px system-ui;color:#ede8dc;padding:24px}*{box-sizing:border-box}#opened{padding:12px;font-size:13px;color:#9edbd2;position:sticky;bottom:0;background:#192c34}button,select{font:inherit}</style><div id="atlas"></div><div id="opened" role="status">Preview: place links show their vault destination here.</div><script>${safeAreaFixture}</script><script src="atlas.js"></script></html>`);
console.log(out);
