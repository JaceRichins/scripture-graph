import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2022",
  outfile: "dist/main.js",
  logLevel: "info",
});
console.log("plugin bundled → dist/main.js");
