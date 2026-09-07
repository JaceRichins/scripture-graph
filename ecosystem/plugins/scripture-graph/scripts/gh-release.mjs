// Publish the built plugin as a GitHub release so phones can install it
// from inside Obsidian (BRAT: "Add beta plugin" → JaceRichins/scripture-graph).
// Tag = manifest version, assets = the three plugin files. Needs `gh auth
// login` once on this machine. Run from the plugin folder after `npm run build`.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;
for (const f of ["dist/main.js", "manifest.json", "styles.css"]) {
  if (!existsSync(f)) { console.error(`missing ${f} — run npm run build first`); process.exit(1); }
}
const gh = (...a) => execFileSync("gh", a, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
try { gh("auth", "status"); } catch { console.error("gh is not logged in: run `gh auth login` once"); process.exit(1); }
try { gh("release", "view", version); console.log(`release ${version} already exists`); process.exit(0); } catch { /* new */ }
gh("release", "create", version, "dist/main.js#main.js", "manifest.json", "styles.css",
  "--title", `Scripture Graph ${version}`, "--notes", `Plugin build ${version}. Installs through BRAT or the family server.`);
console.log(`published release ${version} → https://github.com/JaceRichins/scripture-graph/releases/tag/${version}`);
