// Requires owner approval: even the local plugin files are distributed by vault sync.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve('../../..');
if(!process.argv.includes('--include-family-channel'))throw Error('Deployment approval required: the local vault also distributes plugin files to family devices.');
const destinations=[join(root,'Scripture Graph/.obsidian/plugins/scripture-graph'),join(root,'ecosystem/server/plugin-release')];
const manifests=['manifest.json',...destinations.map(p=>join(p,'manifest.json'))];
const parsed=manifests.filter(existsSync).map(p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,'')));
const versions=parsed.map(m=>m.version.split('.').map(Number)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
const last=versions.at(-1);const next=[last[0],last[1],last[2]+1].join('.');
const own=parsed[0];own.version=next;writeFileSync('manifest.json',JSON.stringify(own,null,2)+'\n');
execFileSync('cmd.exe',['/d','/s','/c','npm run build'],{stdio:'inherit'});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
for(const [i,dir] of destinations.entries()){
  if(!existsSync(dir))throw Error('Missing existing install: '+dir);
  const backup=join(root,'Scripture Graph/.scripture-engine/state/atlas-plugin-backup',stamp,String(i));mkdirSync(backup,{recursive:true});
  for(const name of ['main.js','styles.css','manifest.json'])if(existsSync(join(dir,name)))copyFileSync(join(dir,name),join(backup,name));
  copyFileSync('dist/main.js',join(dir,'main.js'));copyFileSync('styles.css',join(dir,'styles.css'));copyFileSync('manifest.json',join(dir,'manifest.json'));
}
console.log('Installed atlas version '+next+' in '+destinations.join(', ')+'; backups saved.');
