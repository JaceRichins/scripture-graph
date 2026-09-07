/** Live link to the family server: one held request at a time, answered
 * the moment a new plugin build or a vault change lands on the laptop.
 * A new build installs itself and reloads; a vault change starts a sync.
 * Nothing for the reader to tap. */
import { requestUrl } from "obsidian";
import type SGPlugin from "./main";
import { BUILD } from "./build";
import { trace } from "./study/trace";

const HOLD_S = 20;               // how long the server may hold the request
const MIN_BACKOFF = 4_000;
const MAX_BACKOFF = 90_000;

export class LiveLink {
  private stopped = false;
  private backoff = MIN_BACKOFF;
  private timer: number | null = null;
  private inflight = false;
  lastVault: string | null = null;

  constructor(private p: SGPlugin) {}

  start(): void {
    this.stopped = false;
    this.schedule(0);
    // a phone coming back to the foreground has been asleep: ask at once
    document.addEventListener("visibilitychange", this.onVisible);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) window.clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => { if (!document.hidden) this.schedule(0); };

  private schedule(ms: number): void {
    if (this.stopped) return;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    if (this.stopped || this.inflight) return;
    if (document.hidden) { this.schedule(15_000); return; }   // asleep: no point holding a line
    this.inflight = true;
    try {
      const base = this.p.state.api.baseUrl.replace(/\/$/, "");
      const vault = this.lastVault ?? this.p.vaultSync.status.lastVersion ?? "";
      const q = new URLSearchParams({ plugin: BUILD.version, vault, wait: String(HOLD_S) });
      const r = await requestUrl({ url: `${base}/live?${q.toString()}`, throw: false });
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const cur = JSON.parse(r.text.replace(/^﻿/, "")) as { plugin?: string; vault?: string };
      this.backoff = MIN_BACKOFF;
      if (cur.plugin && cur.plugin !== BUILD.version) {
        trace("live.plugin", { from: BUILD.version, to: cur.plugin });
        await this.p.checkForUpdate(true);          // installs and reloads when it is newer
      }
      if (cur.vault && cur.vault !== vault) {
        this.lastVault = cur.vault;
        trace("live.vault", { version: cur.vault });
        void this.p.vaultSync.run("live");
      }
      this.inflight = false;
      this.schedule(250);
    } catch (e) {
      this.inflight = false;
      trace("live.error", { error: (e as Error).message, backoff: this.backoff });
      this.schedule(this.backoff);
      this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
    }
  }
}
