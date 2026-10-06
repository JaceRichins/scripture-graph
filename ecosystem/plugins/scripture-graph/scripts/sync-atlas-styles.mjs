import {readFileSync,writeFileSync} from 'node:fs';
const start='/* BEGIN SCRIPTURE ATLAS */',end='/* END SCRIPTURE ATLAS */';
let css=readFileSync('styles.css','utf8');
if(css.includes(start)) css=css.slice(0,css.indexOf(start))+css.slice(css.indexOf(end)+end.length);
else {
  // Older atlas was appended in two isolated blocks around timeline rules.
  css=css.replace(/\.sg-atlas\{--atlas-ink:#ede8dc[\s\S]*?(?=\/\* Timeline controls)/,'');
  css=css.replace(/\.sg-atlas-viewport\{position:relative;width:100%;max-width:100%\}[^\r\n]*\r?\n@media\(max-width:800px\)\{\.sg-atlas-main[^\r\n]*\r?\n/,'');
}
css=css.trimEnd()+'\n\n'+start+'\n'+readFileSync('src/study/atlas/atlas.css','utf8').trim()+'\n'+end+'\n';
writeFileSync('styles.css',css);
console.log('Updated isolated atlas stylesheet; preserved other plugin styles.');
