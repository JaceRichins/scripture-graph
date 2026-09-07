// Ship the plugin in one move: bump past whatever is live, typecheck +
// bundle, copy to both channels, commit, push, GitHub release when gh is
// logged in. The server's live channel then wakes every phone, which
// installs and reloads on its own. Usage, from the plugin folder:
//
//   npm run ship -- "what changed"
//
// Refuses to run outside the main checkout on master, and never ships a
// number at or below the server's — the runbook's rules, enforced.
import { execFileSync, execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const msg = process.argv.slice(2).join(" ").trim();
if (!msg) { console.error('usage: npm run ship -- "what changed"'); process.exit(1); }

const plugin = process.cwd();
const root = resolve(plugin, "../../..");
const server = resolve(root, "ecosystem/server");
const vaultPlugin = resolve(root, "Scripture Graph/.obsidian/plugins/scripture-graph");
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "inherit"], ...opts }).toString().trim();

// ---- guards: main checkout, master, not behind ------------------------
const top = sh("git rev-parse --show-toplevel").replace(/\//g, "\\").toLowerCase();
if (top !== root.replace(/\//g, "\\").toLowerCase()) { console.error(`not the main checkout: ${top}`); process.exit(1); }
if (sh("git rev-parse --abbrev-ref HEAD") !== "master") { console.error("not on master"); process.exit(1); }
try { sh("git fetch -q origin main"); } catch { /* offline: local knowledge will do */ }
const behind = Number(sh("git rev-list --count HEAD..origin/main") || "0");
if (behind > 0) { console.error(`master is ${behind} commits behind origin/main — pull first`); process.exit(1); }

// ---- version: one above the higher of local and live -----------------
const mfPath = join(plugin, "manifest.json");
const mf = JSON.parse(readFileSync(mfPath, "utf8").replace(/^﻿/, ""));
const parse = v => String(v ?? "0.0.0").split(".").map(n => parseInt(n, 10) || 0);
const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0; };
let live = "0.0.0";
for (const p of [join(server, "plugin-release/manifest.json"), join(vaultPlugin, "manifest.json")]) {
  try { const v = JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")).version; if (cmp(v, live) > 0) live = v; } catch { /* absent */ }
}
try {
  const out = execSync('curl -s --max-time 4 http://127.0.0.1:8930/plugin/manifest.json', { stdio: ["ignore", "pipe", "ignore"] }).toString();
  const v = JSON.parse(out.replace(/^﻿/, "")).version; if (v && cmp(v, live) > 0) live = v;
} catch { /* server down: disk copies are the floor */ }
const base = cmp(mf.version, live) > 0 ? mf.version : live;
const [ma, mi, pa] = parse(base);
const next = `${ma}.${mi}.${pa + 1}`;
mf.version = next;
writeFileSync(mfPath, JSON.stringify(mf, null, 2) + "\n");
console.log(`shipping ${next} (live was ${live})`);

// ---- build (typecheck gates it) ------------------------------------------
execSync("npm run build", { cwd: plugin, stdio: "inherit" });
const banner = readFileSync(join(plugin, "dist/main.js"), "utf8").slice(0, 120);
if (!banner.includes(`v${next} `)) { console.error("bundle banner does not carry the new version"); process.exit(1); }

// ---- both channels --------------------------------------------------------
for (const dir of [vaultPlugin, join(server, "plugin-release")]) {
  if (!existsSync(dir)) { console.error(`missing ${dir}`); process.exit(1); }
  copyFileSync(join(plugin, "dist/main.js"), join(dir, "main.js"));
  copyFileSync(join(plugin, "styles.css"), join(dir, "styles.css"));
  copyFileSync(mfPath, join(dir, "manifest.json"));      // manifest LAST: it is the signal
}

// ---- commit + push ----------------------------------------------------------
execFileSync("git", ["add", "-A", "ecosystem/plugins/scripture-graph/src", "ecosystem/plugins/scripture-graph/styles.css",
  "ecosystem/plugins/scripture-graph/manifest.json", "ecosystem/plugins/scripture-graph/package.json",
  "ecosystem/plugins/scripture-graph/scripts", "ecosystem/packages/core-sdk/src", "ecosystem/server/src",
  "ecosystem/docs", "Scripture Graph/.obsidian/plugins/scripture-graph"], { cwd: root, stdio: "inherit" });
const body = `plugin v${next}: ${msg}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_018mbK951BF9oRqVqkuE7aK8`;
try { execFileSync("git", ["commit", "-q", "-m", body], { cwd: root, stdio: "inherit" }); }
catch { console.log("nothing new to commit beyond the version bump?"); }
try { execFileSync("git", ["push", "-q", "origin", "master:main"], { cwd: root, stdio: "inherit" }); }
catch { console.error("push failed — the build is live on the server regardless; push by hand"); }

// ---- GitHub release (BRAT) — best effort ---------------------------------------
try { execSync("node scripts/gh-release.mjs", { cwd: plugin, stdio: "inherit" }); }
catch { console.log("(no GitHub release: gh is not logged in — phones still update from the server)"); }

// ---- proof -----------------------------------------------------------------------
try {
  const out = execSync('curl -s --max-time 6 http://127.0.0.1:8930/plugin/manifest.json', { stdio: ["ignore", "pipe", "ignore"] }).toString();
  const v = JSON.parse(out.replace(/^﻿/, "")).version;
  console.log(v === next ? `✓ server serves ${v}; phones on the live channel update within seconds`
    : `! server serves ${v}, expected ${next} — is the server running?`);
} catch { console.log("! server not reachable on 127.0.0.1:8930 — phones update once it is"); }
