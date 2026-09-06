/** 🔁 Vault sync — the plugin carries the vault itself, so nobody pays for
 * a copy service.
 *
 * SHARED tree (from the family server, read-only here): one version check
 * per run; when it moved, the manifest, a diff against what this device
 * holds, and only the changed files, fetched in batches of many files per
 * request, four requests in flight. Deletions follow the manifest. Which
 * shelves a device carries is its own choice (Scriptures always).
 *
 * PERSONAL tree (`Library/`, two-way per user): local edits push with the
 * hash they were edited from; server-side changes pull. A real conflict
 * (both sides moved) keeps both — the server's copy lands as
 * "<name> (conflict from <device>)" beside yours, never silently over it.
 *
 * SOURCE device: the laptop that runs the engine already holds the shared
 * tree (it IS the server's vault); it pushes and pulls personal notes only.
 *
 * State: the file index (path → hash) lives in the plugin's local store,
 * not in the vault, so it never syncs itself. */
import { Notice, TFile, normalizePath } from "obsidian";
import { SGState } from "../state";

export interface SyncSection { key: string; label: string; prefix: string; always?: boolean }

/** the shelves a device can choose to carry — the rest always comes */
export const SECTIONS: SyncSection[] = [
  { key: "scriptures", label: "Scriptures, study guides, footnotes", prefix: "AI Library/01 Scriptures/", always: true },
  { key: "topics", label: "Gospel Topics, doctrines, people, places, events", prefix: "AI Library/0", always: true },
  { key: "conference", label: "General Conference (2,900 talks)", prefix: "AI Library/10 General Conference/" },
  { key: "history", label: "Church History (Saints, prophets, periodicals)", prefix: "AI Library/30 Church History/" },
  { key: "findings", label: "Findings (1,700 notes)", prefix: "AI Library/40 Findings/" },
  { key: "questions", label: "Hard Questions", prefix: "AI Library/50 Questions/" },
  { key: "podcasts", label: "Podcasts & talks", prefix: "AI Library/65 Secondary Sources/" },
  { key: "dictionary", label: "Bible Dictionary, Topical Guide", prefix: "AI Library/80 Bible Dictionary/" },
  { key: "timeline", label: "Timeline pages", prefix: "AI Library/90 Timeline/" },
];

export interface SyncPrefs { enabled: boolean; sections: Record<string, boolean>; intervalMin: number }
export const DEFAULT_SYNC: SyncPrefs = { enabled: true, sections: {}, intervalMin: 30 };

export interface SyncStatus {
  running: boolean; phase: string; done: number; total: number;
  lastRun: string | null; lastVersion: string | null; lastError: string | null; files: number;
  personalPushed: number; personalPulled: number; conflicts: number;
}

type Index = Record<string, string>;                 // shared: path → hash
type PIndex = Record<string, { hash: string; mtime: number; base: string | null }>;   // personal

const INDEX_KEY = "vaultsync:index";
const PINDEX_KEY = "vaultsync:personal";
const PSINCE_KEY = "vaultsync:personal-since";

export function syncPrefs(s: SGState): SyncPrefs {
  const d = s.device as { sync?: Partial<SyncPrefs> };
  return { ...DEFAULT_SYNC, ...(d.sync ?? {}), sections: { ...(d.sync?.sections ?? {}) } };
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function b64ToBytes(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export class VaultSync {
  status: SyncStatus = { running: false, phase: "idle", done: 0, total: 0, lastRun: null, lastVersion: null,
    lastError: null, files: 0, personalPushed: 0, personalPulled: 0, conflicts: 0 };
  listeners: (() => void)[] = [];
  private timer: number | null = null;
  private dirty = new Set<string>();
  private dirtyTimer: number | null = null;
  private source: boolean | null = null;

  constructor(private s: SGState, private deviceName: () => string) {}

  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } }
  private set(patch: Partial<SyncStatus>): void { Object.assign(this.status, patch); this.emit(); }

  /** the engine's own machine holds the shared tree already */
  async isSource(): Promise<boolean> {
    if (this.source === null) this.source = await this.s.app.vault.adapter.exists(".scripture-engine/config/config.yaml");
    return this.source;
  }

  start(): void {
    const p = syncPrefs(this.s);
    this.stop();
    if (!p.enabled || !this.s.device.deviceToken) return;
    window.setTimeout(() => void this.run("startup"), 4_000);
    this.timer = window.setInterval(() => void this.run("interval"), Math.max(5, p.intervalMin) * 60_000);
  }

  stop(): void {
    if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
  }

  /** a personal file changed here — push soon (debounced) */
  noteChanged(path: string): void {
    if (!path.startsWith("Library/")) return;
    this.dirty.add(path);
    if (this.dirtyTimer) window.clearTimeout(this.dirtyTimer);
    this.dirtyTimer = window.setTimeout(() => void this.pushPersonal(), 2_500);
  }

  async run(reason: string): Promise<void> {
    if (this.status.running) return;
    if (!this.s.device.deviceToken) { this.set({ lastError: "not signed in" }); return; }
    this.set({ running: true, phase: "checking", lastError: null, done: 0, total: 0 });
    try {
      if (!(await this.isSource())) await this.syncShared();
      await this.pushPersonal();
      await this.pullPersonal();
      this.set({ running: false, phase: "idle", lastRun: new Date().toISOString() });
    } catch (e) {
      this.set({ running: false, phase: "idle", lastError: String((e as Error)?.message ?? e) });
      if (reason === "manual") new Notice(`Sync: ${this.status.lastError}`);
    }
  }

  // ---------------------------------------------------------------- shared

  private wanted(path: string, prefs: SyncPrefs): boolean {
    for (const sec of SECTIONS) {
      if (path.startsWith(sec.prefix)) return sec.always || prefs.sections[sec.key] !== false;
    }
    return true;   // everything outside the optional shelves comes along
  }

  private async syncShared(): Promise<void> {
    const prefs = syncPrefs(this.s);
    const api = this.s.api;
    const v = await api.vaultVersion();
    const index = (await this.s.store.get<Index>(INDEX_KEY)) ?? {};
    if (v.version === this.status.lastVersion && Object.keys(index).length) return;
    this.set({ phase: "manifest" });
    const m = await api.vaultManifest();
    const adapter = this.s.app.vault.adapter;
    const want = new Map<string, string>();
    for (const f of m.files) if (this.wanted(f.p, prefs)) want.set(f.p, f.h);
    // what to fetch: new, changed, or missing on disk
    const todo: string[] = [];
    for (const [p, h] of want) {
      if (index[p] !== h) { todo.push(p); continue; }
      if (!(await adapter.exists(normalizePath(p)))) todo.push(p);
    }
    // what to remove: held by us (per the index) and gone from the manifest, or no longer wanted
    const gone: string[] = [];
    for (const p of Object.keys(index)) if (!want.has(p)) gone.push(p);
    this.set({ phase: "downloading", total: todo.length, done: 0 });
    const folders = new Set<string>();
    const ensureFolder = async (p: string) => {
      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      if (!dir || folders.has(dir)) return;
      const parts = dir.split("/");
      for (let i = 1; i <= parts.length; i++) {
        const d = parts.slice(0, i).join("/");
        if (folders.has(d)) continue;
        if (!(await adapter.exists(normalizePath(d)))) { try { await adapter.mkdir(normalizePath(d)); } catch { /* raced */ } }
        folders.add(d);
      }
    };
    const BATCH = 120, PARALLEL = 4;
    let cursor = 0;
    const worker = async () => {
      while (cursor < todo.length) {
        const chunk = todo.slice(cursor, cursor + BATCH);
        cursor += BATCH;
        const { files } = await api.vaultBatch(chunk);
        for (const f of files) {
          if (f.missing) continue;
          await ensureFolder(f.p);
          const np = normalizePath(f.p);
          if (f.text !== undefined) await adapter.write(np, f.text);
          else if (f.b64 !== undefined) await adapter.writeBinary(np, b64ToBytes(f.b64));
          index[f.p] = want.get(f.p) ?? f.h ?? "";
          this.status.done++;
        }
        // partial batch (size cap): ask again for what is still missing
        const got = new Set(files.map(x => x.p));
        const rest = chunk.filter(p => !got.has(p));
        if (rest.length && rest.length < chunk.length) todo.push(...rest);
        await this.s.store.put(INDEX_KEY, index);
        this.emit();
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, Math.max(1, todo.length)) }, worker));
    this.set({ phase: "cleaning" });
    for (const p of gone) {
      try { if (await adapter.exists(normalizePath(p))) await adapter.remove(normalizePath(p)); } catch { /* keep */ }
      delete index[p];
    }
    await this.s.store.put(INDEX_KEY, index);
    this.set({ lastVersion: v.version, files: Object.keys(index).length });
  }

  // -------------------------------------------------------------- personal

  private async personalIndex(): Promise<PIndex> { return (await this.s.store.get<PIndex>(PINDEX_KEY)) ?? {}; }

  private async listLocalPersonal(): Promise<string[]> {
    return this.s.app.vault.getFiles().filter(f => f.path.startsWith("Library/") && f.extension === "md").map(f => f.path);
  }

  async pushPersonal(): Promise<void> {
    if (!this.s.device.deviceToken) return;
    const pidx = await this.personalIndex();
    const paths = this.dirty.size ? [...this.dirty] : await this.listLocalPersonal();
    this.dirty.clear();
    const items: { path: string; content: string | null; hash: string | null; base_hash: string | null; mtime: number; deleted?: boolean }[] = [];
    for (const p of paths) {
      const af = this.s.app.vault.getAbstractFileByPath(p);
      if (af instanceof TFile) {
        const content = await this.s.app.vault.read(af);
        const h = await sha(content);
        if (pidx[p]?.hash === h) continue;                      // unchanged since last sync
        items.push({ path: p, content, hash: h, base_hash: pidx[p]?.hash ?? null, mtime: af.stat.mtime });
      } else if (pidx[p]) {
        items.push({ path: p, content: null, hash: null, base_hash: pidx[p]!.hash, mtime: Date.now(), deleted: true });
      }
    }
    if (!items.length) return;
    this.set({ phase: "pushing notes" });
    for (let i = 0; i < items.length; i += 100) {
      const { results } = await this.s.api.personalPush(items.slice(i, i + 100));
      for (const r of results) {
        const it = items.find(x => x.path === r.path)!;
        if (r.status === "stored") {
          if (it.deleted) delete pidx[r.path];
          else pidx[r.path] = { hash: it.hash!, mtime: it.mtime, base: it.hash };
          this.status.personalPushed++;
        } else if (r.status === "conflict" && r.server) {
          // both moved: keep both, the server's as a conflict copy beside yours
          const copy = r.path.replace(/\.md$/, "") + ` (conflict from another device).md`;
          if (r.server.content !== null) await this.s.app.vault.adapter.write(normalizePath(copy), r.server.content);
          pidx[r.path] = { hash: r.server.hash ?? "", mtime: r.server.mtime, base: r.server.hash };
          this.status.conflicts++;
          new Notice(`Sync kept both versions of ${r.path.split("/").pop()}`);
          this.dirty.add(r.path);              // ours goes up next time, edited from theirs
        }
      }
    }
    await this.s.store.put(PINDEX_KEY, pidx);
    this.emit();
  }

  async pullPersonal(): Promise<void> {
    if (!this.s.device.deviceToken) return;
    const since = (await this.s.store.get<string>(PSINCE_KEY)) ?? undefined;
    const { files, now } = await this.s.api.personalManifest(since);
    if (!files.length) { await this.s.store.put(PSINCE_KEY, now); return; }
    this.set({ phase: "pulling notes" });
    const pidx = await this.personalIndex();
    const adapter = this.s.app.vault.adapter;
    for (const f of files) {
      const np = normalizePath(f.path);
      const local = pidx[f.path];
      if (f.deleted_at) {
        if (local && (await adapter.exists(np))) { try { await adapter.remove(np); } catch { /* keep */ } }
        delete pidx[f.path];
        continue;
      }
      if (local?.hash === f.hash) continue;                    // we sent this one
      const af = this.s.app.vault.getAbstractFileByPath(f.path);
      if (af instanceof TFile) {
        const mine = await sha(await this.s.app.vault.read(af));
        if (local && mine !== local.hash) {
          // edited here too since the last sync: theirs lands beside ours
          const row = await this.s.api.personalFile(f.path);
          if (row.content !== null) await adapter.write(normalizePath(f.path.replace(/\.md$/, "") + " (conflict from another device).md"), row.content);
          this.status.conflicts++;
          continue;
        }
      }
      const row = await this.s.api.personalFile(f.path);
      if (row.content === null) continue;
      const dir = f.path.slice(0, f.path.lastIndexOf("/"));
      if (dir && !(await adapter.exists(normalizePath(dir)))) {
        const parts = dir.split("/");
        for (let i = 1; i <= parts.length; i++) {
          const d = parts.slice(0, i).join("/");
          if (!(await adapter.exists(normalizePath(d)))) { try { await adapter.mkdir(normalizePath(d)); } catch { /* raced */ } }
        }
      }
      await adapter.write(np, row.content);
      pidx[f.path] = { hash: f.hash ?? "", mtime: f.mtime, base: f.hash };
      this.status.personalPulled++;
    }
    await this.s.store.put(PINDEX_KEY, pidx);
    await this.s.store.put(PSINCE_KEY, now);
    this.emit();
  }

  /** wipe what this device holds of the optional shelves it no longer wants */
  async resetIndex(): Promise<void> {
    await this.s.store.put(INDEX_KEY, {});
    this.set({ lastVersion: null, files: 0 });
  }
}
