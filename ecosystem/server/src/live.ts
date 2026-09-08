/** Live channel — phones learn about a new plugin build or a changed
 * vault within seconds of it landing on the laptop, instead of on a timer.
 *
 * One long-poll: GET /live?plugin=<running>&vault=<synced>&wait=20 holds
 * until either version differs from what the device reports (or the wait
 * runs out), then answers with the current pair. The device reconnects at
 * once. The server watches the plugin folder and the vault tree with
 * fs.watch, so a change wakes every waiter at the same moment; nothing
 * polls the disk. */
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { invalidateManifest, manifest } from "./vault";

export class Live {
  private waiters = new Set<() => void>();
  private pluginVersion = "";
  private vaultVersion = "";
  private vaultDirty = true;
  private timers: NodeJS.Timeout[] = [];
  private watchers: FSWatcher[] = [];

  constructor(private pluginDir: string, private vaultRoot: string) {
    this.readPlugin();
    this.watchDir(pluginDir, false, () => { this.readPlugin(); this.wake(); });
    if (vaultRoot && existsSync(vaultRoot)) {
      // pictures landing one a second (a family pull), the engine's own
      // state, git: none of it is a page — phones are not woken for it
      this.watchDir(vaultRoot, true, () => this.vaultChanged(),
        (name) => !/(^|[\\/])(_media|\.git|\.scripture-engine|\.obsidian|\.trash)([\\/]|$)/.test(name));
    }
  }

  /** a vault change wakes phones at most every WAKE_MIN_MS: a burst of
   * writes (a study tick, a shelf being built) is one sync, not fifty */
  private static readonly WAKE_MIN_MS = 30_000;
  private lastVaultWake = 0;
  private wakeTimer: NodeJS.Timeout | null = null;
  private vaultChanged(): void {
    this.vaultDirty = true;
    const due = this.lastVaultWake + Live.WAKE_MIN_MS - Date.now();
    if (due <= 0) { this.lastVaultWake = Date.now(); this.wake(); return; }
    if (this.wakeTimer) return;
    this.wakeTimer = setTimeout(() => { this.wakeTimer = null; this.lastVaultWake = Date.now(); this.wake(); }, due);
    this.timers.push(this.wakeTimer);
  }

  /** the versions right now (the vault's only recomputed after a change) */
  current(): { plugin: string; vault: string } {
    if (this.vaultDirty && this.vaultRoot && existsSync(this.vaultRoot)) {
      invalidateManifest();
      this.vaultVersion = manifest(this.vaultRoot).version;
      this.vaultDirty = false;
    }
    return { plugin: this.pluginVersion, vault: this.vaultVersion };
  }

  /** resolve when the versions differ from the device's, or after `ms` */
  wait(plugin: string, vault: string, ms: number): Promise<{ plugin: string; vault: string }> {
    return new Promise(resolve => {
      const check = () => {
        const cur = this.current();
        if (cur.plugin !== plugin || cur.vault !== vault) { done(); resolve(cur); return true; }
        return false;
      };
      const done = () => { this.waiters.delete(check); clearTimeout(t); };
      const t = setTimeout(() => { done(); resolve(this.current()); }, ms);
      if (!check()) this.waiters.add(check);
    });
  }

  close(): void {
    for (const w of this.watchers) { try { w.close(); } catch { /* closing */ } }
    for (const t of this.timers) clearTimeout(t);
  }

  private readPlugin(): void {
    try {
      const p = join(this.pluginDir, "manifest.json");
      if (!existsSync(p)) return;
      const v = (JSON.parse(readFileSync(p, "utf8").replace(/^﻿/, "")) as { version?: string }).version;
      if (v) this.pluginVersion = v;
    } catch { /* a half-written manifest: the next event re-reads it */ }
  }

  /** debounced: a build or a vault regeneration is many events */
  private watchDir(dir: string, recursive: boolean, onChange: () => void, accept?: (name: string) => boolean): void {
    let t: NodeJS.Timeout | null = null;
    try {
      const w = watch(dir, { recursive, persistent: false }, (_evt, filename) => {
        if (accept && filename && !accept(String(filename))) return;
        if (t) clearTimeout(t);
        t = setTimeout(() => { t = null; onChange(); }, 1200);
        this.timers.push(t);
      });
      w.on("error", () => { /* watcher died (drive asleep): waiters still time out and re-ask */ });
      this.watchers.push(w);
    } catch { /* no watch support: the timeout path still works */ }
  }

  private wake(): void {
    for (const c of [...this.waiters]) { try { c(); } catch { /* one waiter */ } }
  }
}
