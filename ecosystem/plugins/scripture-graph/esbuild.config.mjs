import esbuild from "esbuild";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Stamp the bundle with what it IS: manifest version, git sha of the tree
// it was built from (the release commit lands after the build), and when.
// The banner is the FIRST line of main.js — the plugin reads it back off
// disk (src/build.ts) to tell a half-synced install from a finished one.
const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;
let sha = "nogit";
try {
  sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
    .toString().trim();
} catch { /* not inside a checkout */ }
const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: "dist/main.js",
  logLevel: "info",
  banner: { js: `/* scripture-graph v${version} build ${sha} ${at} */` },
  define: { __SG_BUILD__: JSON.stringify({ version, sha, at }) },
});
console.log(`plugin bundled → dist/main.js  (v${version} build ${sha} ${at})`);
