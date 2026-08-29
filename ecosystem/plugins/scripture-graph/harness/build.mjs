import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("harness-dist", { recursive: true });
await esbuild.build({
  entryPoints: ["harness/main.ts"],
  bundle: true,
  outfile: "harness-dist/main.js",
  format: "iife",
  platform: "browser",
  alias: { obsidian: "./harness/obsidian-shim.ts" },
  logLevel: "info",
});
copyFileSync("harness/index.html", "harness-dist/index.html");
copyFileSync("styles.css", "harness-dist/styles.css");
console.log("harness built → harness-dist/");
