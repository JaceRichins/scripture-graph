/** 🏷 Build identity, stamped by esbuild (esbuild.config.mjs): the version
 * the CODE was built from, its git sha, and when.
 *
 * `manifest.json` says what Obsidian *thinks* is installed; this says
 * what is actually running. Obsidian Sync delivers the 350-byte manifest
 * long before the 590 KB main.js, so on every device the two disagree
 * for a while — and a reload inside that window loads the new manifest
 * over the OLD code, which then reports the new number while behaving
 * like the old build (a phone did exactly this and sent a v0.61.0 log
 * from pre-0.61 code). The debug-log header, the settings pane and the
 * sync-update check all read THIS, so that lie is visible and the reload
 * is only offered once the code has actually arrived. */
declare const __SG_BUILD__: { version: string; sha: string; at: string } | undefined;

export const BUILD: { version: string; sha: string; at: string } =
  typeof __SG_BUILD__ !== "undefined" ? __SG_BUILD__ : { version: "dev", sha: "dev", at: "" };

/** the banner esbuild writes as the first line of main.js — the sync
 * check reads it straight off disk to learn which code a device holds */
export const BANNER_RE = /^\/\* scripture-graph v(\d+\.\d+\.\d+) build (\S+) (\S+) \*\//;
