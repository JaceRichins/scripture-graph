// Synthetic viewport fixture; no vault data or AI requests.
import http from 'node:http';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>:root{--background-primary:#202020;--background-modifier-border:#444;--text-normal:#eee}body{margin:0;font:16px system-ui}button,textarea{background:#333;color:#eee;border:1px solid #555}${css}</style>
  <body class="is-mobile"><div class="sg-ai-workspace" style="height:420px!important;top:0!important;width:390px!important"><div class="view-content sg-ask">
  <div class="sg-ask-header"><button>Files</button><span class="sg-ask-title">Ask AI</span><button>More</button><button>Done</button></div>
  <div class="sg-ask-log"><div class="sg-turn sg-turn-user">Build a family lesson about trust.</div><div class="sg-turn sg-turn-assistant">Your lesson and references are ready in <strong>Trust in the Lord</strong>. Open Files to read or edit them.</div>${Array(3).fill('<div class="sg-turn sg-turn-assistant">Read <a href="#">Proverbs 3</a> together and ask: when has trusting God helped our family?</div>').join('')}</div>
  <div class="sg-ai-page" hidden></div><div class="sg-ask-presets" hidden></div>
  <div class="sg-ask-input"><textarea aria-label="Your question">Make it suitable for children</textarea><button class="sg-ai-send">↑</button><button class="sg-ai-tools">+</button></div>
  </div></div><div style="position:fixed;top:420px;height:400px;background:#555;width:100%">Simulated keyboard area</div></body>`);
}).listen(8931, '127.0.0.1');
