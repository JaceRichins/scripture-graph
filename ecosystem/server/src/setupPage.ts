/** /setup — the page a family member opens on their phone. Big steps, one
 * per screen-height, and a Connect button that hands the invite to the
 * plugin (obsidian://scripture-graph-setup). The invite rides in the
 * query string and never touches the server: the page reads it in the
 * browser. The plugin installs from GitHub through BRAT, so nothing
 * touches the Files app or hidden folders. */
export const GITHUB_REPO = "JaceRichins/scripture-graph";

export function setupHtml(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scripture Graph setup</title>
<style>
  :root { color-scheme: light dark; --ink:#1d1a16; --soft:#6b655c; --ground:#faf7f1; --card:#fff; --line:#e6e0d4; --accent:#6a4bd6; }
  @media (prefers-color-scheme: dark) { :root { --ink:#f1ede6; --soft:#a49d92; --ground:#14120f; --card:#1e1b17; --line:#2e2a24; --accent:#a48dff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font: 19px/1.5 -apple-system, "SF Pro Text", Segoe UI, Roboto, sans-serif; }
  main { max-width: 34rem; margin: 0 auto; padding: 28px 20px 80px; }
  h1 { font-size: 30px; line-height:1.15; margin: 0 0 6px; letter-spacing:-.01em; }
  .lede { color: var(--soft); margin: 0 0 28px; }
  section { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 20px 20px 18px; margin: 0 0 16px; }
  .n { display:inline-block; width:34px; height:34px; border-radius:50%; background:var(--accent); color:#fff; text-align:center; line-height:34px; font-weight:700; margin-right:10px; }
  h2 { display:flex; align-items:center; font-size: 22px; margin: 0 0 12px; }
  ol { padding-left: 22px; margin: 0; } li { margin: 8px 0; }
  code { background: rgba(127,127,127,.14); padding: 3px 8px; border-radius: 8px; font-size: 17px; }
  .btn { display:block; text-align:center; text-decoration:none; font-weight:700; font-size:20px; padding:16px 18px; border-radius:14px; background:var(--accent); color:#fff; margin: 14px 0 4px; }
  .btn.quiet { background: transparent; color: var(--accent); border: 2px solid var(--accent); }
  .small { color: var(--soft); font-size: 16px; }
  button.copy { font: inherit; font-size:16px; padding:8px 14px; border-radius:10px; border:1px solid var(--line); background:transparent; color:var(--ink); }
  details { margin-top: 14px; } summary { color: var(--soft); cursor: pointer; }
  .missing { border-color: #d6a04b; }
</style></head>
<body><main>
<h1>Scripture Graph on your phone</h1>
<p class="lede">Four short steps, about five minutes. After this it takes care of itself.</p>

<section>
  <h2><span class="n">1</span>Get the Obsidian app</h2>
  <p>It's the free notebook app Scripture Graph lives inside. If you already have it, skip ahead.</p>
  <a class="btn" href="https://apps.apple.com/app/obsidian-connected-notes/id1557175442">App Store (iPhone)</a>
  <a class="btn quiet" href="https://play.google.com/store/apps/details?id=md.obsidian">Google Play (Android)</a>
</section>

<section>
  <h2><span class="n">2</span>Make a notebook</h2>
  <ol>
    <li>Open Obsidian and tap <b>Create new vault</b>.</li>
    <li>Name it <code>Scripture Graph</code>.</li>
    <li>Keep it <b>on this phone</b> (not iCloud). Tap <b>Create</b>.</li>
  </ol>
</section>

<section>
  <h2><span class="n">3</span>Add Scripture Graph</h2>
  <ol>
    <li>Tap the gear <b>⚙</b> in the top right, then <b>Community plugins</b>, then <b>Turn on community plugins</b>.</li>
    <li>Tap <b>Browse</b>, search <code>BRAT</code>, tap <b>Install</b>, then <b>Enable</b>, then <b>Options</b>.</li>
    <li>Tap <b>Add beta plugin</b> and paste this: <code>${GITHUB_REPO}</code>
      <button class="copy" onclick="navigator.clipboard.writeText('${GITHUB_REPO}');this.textContent='Copied'">Copy</button></li>
    <li>Tap <b>Add plugin</b>. Scripture Graph installs and switches itself on.</li>
  </ol>
  <details><summary>Another way, if that didn't work</summary>
    <p class="small">Download <a href="/plugin/scripture-graph.zip">this file</a>, open it in the Files app, and move the <b>scripture-graph</b> folder into
    <i>On My iPhone → Obsidian → Scripture Graph → .obsidian → plugins</i>. Then turn it on under Community plugins.</p>
  </details>
</section>

<section id="connect">
  <h2><span class="n">4</span>Connect</h2>
  <p>Come back to this page and tap the button. Obsidian opens, asks your first name, and downloads the library.</p>
  <a class="btn" id="go" href="#">Connect Scripture Graph</a>
  <p class="small" id="hint"></p>
</section>

<script>
  var q = new URLSearchParams(location.search);
  var invite = q.get("invite") || "";
  var server = q.get("server") || location.origin;
  var go = document.getElementById("go"), hint = document.getElementById("hint"), sec = document.getElementById("connect");
  if (invite) {
    var p = new URLSearchParams({ server: server, invite: invite });
    if (q.get("name")) p.set("name", q.get("name"));
    go.href = "obsidian://scripture-graph-setup?" + p.toString();
    hint.textContent = "If nothing happens, make sure step 3 finished, then tap again.";
  } else {
    go.href = "#"; go.classList.add("quiet"); go.textContent = "Ask for your setup link";
    sec.classList.add("missing");
    hint.textContent = "This page was opened without an invite. The family member who runs Scripture Graph can send you a link that includes it.";
  }
</script>
</main></body></html>`;
}
