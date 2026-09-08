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
import { trace } from "../study/trace";

export interface SyncSection {
  key: string; label: string; prefixes: string[];
  /** every device carries it */
  always?: boolean;
  /** off unless switched on: the shelf still lists it from the server and
   * fetches a page the moment it is opened (and keeps it) */
  defaultOn?: boolean;
}
/** ORDER MATTERS: the first prefix that matches decides, so the scripture
 * sub-folders come before the broad "AI Library/0" topics rule */
export const SECTIONS: SyncSection[] = [
  { key: "scriptures", label: "Scriptures (the text, and the packs the reader needs)", always: true,
    prefixes: ["AI Library/01 Scriptures/Canonical/", "AI Library/01 Scriptures/Packs/", "AI Library/01 Scriptures/JST Appendix/"] },
  { key: "guides", label: "Study guides (one per chapter)", prefixes: ["AI Library/01 Scriptures/Study Guides/"], defaultOn: false },
  { key: "apparatus", label: "Per-chapter footnote and cross-reference pages (the packs carry the same data)",
    prefixes: ["AI Library/01 Scriptures/Footnotes/", "AI Library/01 Scriptures/Cross References/"], defaultOn: false },
  { key: "annotated", label: "Annotated chapter mirrors", prefixes: ["AI Library/01 Scriptures/Annotated/"], defaultOn: false },
  { key: "translations", label: "Bible translations (WEB, ASV, YLT)", prefixes: ["AI Library/01 Scriptures/Translations/"], defaultOn: false },
  { key: "topics", label: "Gospel Topics, doctrines, people, places, events, Come Follow Me", prefixes: ["AI Library/0"], always: true },
  { key: "conference", label: "General Conference (2,900 talks)", prefixes: ["AI Library/10 General Conference/"], defaultOn: false },
  { key: "history", label: "Church History (Saints, prophets, periodicals)", prefixes: ["AI Library/30 Church History/"], defaultOn: false },
  { key: "findings", label: "Findings (1,700 notes)", prefixes: ["AI Library/40 Findings/"], defaultOn: false },
  { key: "questions", label: "Hard Questions", prefixes: ["AI Library/50 Questions/"] },
  { key: "podcasts", label: "Podcasts & talks", prefixes: ["AI Library/65 Secondary Sources/"] },
  { key: "dictionary", label: "Bible Dictionary, Topical Guide", prefixes: ["AI Library/80 Bible Dictionary/"] },
  { key: "timeline", label: "Timeline pages", prefixes: ["AI Library/90 Timeline/"] },
];

/** engine-side data a phone never reads: the raw Church music catalog the
 * laptop uses to resolve links (1.3 MB); the plugin reads Hymns.md/Music.md */
const NEVER_ON_PHONES = ["AI Library/00 System/Church Music.md"];

/** is this section on for the device: its switch, else its default */
export function sectionOn(sec: SyncSection, prefs: SyncPrefs): boolean {
  return !!sec.always || (prefs.sections[sec.key] ?? sec.defaultOn ?? true);
}

export interface SyncPrefs {
  enabled: boolean; sections: Record<string, boolean>; intervalMin: number;
  /** paths and folder prefixes kept regardless of section switches: pages
   * opened on demand, shelves downloaded from the Library */
  pins: string[];
}
export const DEFAULT_SYNC: SyncPrefs = { enabled: true, sections: {}, intervalMin: 30, pins: [] };

/** bumped when the rules above change shape: the next run re-decides every file */
const RULES = 3;
const RULES_KEY = "vaultsync:rules";
const MANIFEST_KEY = "vaultsync:manifest";

/** set by the plugin: fetch a shared page by its name (or path) on demand */
export let lazyFetch: ((nameOrPath: string) => Promise<boolean>) | null = null;
export function setLazyFetch(fn: ((nameOrPath: string) => Promise<boolean>) | null): void { lazyFetch = fn; }

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
  return { ...DEFAULT_SYNC, ...(d.sync ?? {}), sections: { ...(d.sync?.sections ?? {}) }, pins: [...(d.sync?.pins ?? [])] };
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
  /** every shared path the server offers (the last manifest), for shelves
   * that list what is not downloaded yet and for opening it on demand */
  private manifestPaths: string[] = [];
  private manifestLoaded = false;

  constructor(private s: SGState, private deviceName: () => string) {}

  private async loadManifestCache(): Promise<void> {
    if (this.manifestLoaded) return;
    this.manifestLoaded = true;
    const m = await this.s.store.get<{ version: string; paths: string[] }>(MANIFEST_KEY);
    if (m?.paths?.length) this.manifestPaths = m.paths;
  }

  /** shared paths under a folder that this device does not hold */
  remoteUnder(folder: string): { folders: { name: string; path: string }[]; files: { name: string; path: string }[] } {
    const prefix = folder.endsWith("/") ? folder : `${folder}/`;
    const folders = new Map<string, string>();
    const files: { name: string; path: string }[] = [];
    for (const p of this.manifestPaths) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      const cut = rest.indexOf("/");
      if (cut >= 0) { const name = rest.slice(0, cut); if (!folders.has(name)) folders.set(name, prefix + name); continue; }
      if (!rest.endsWith(".md") || rest.startsWith("_")) continue;
      if (this.s.app.vault.getAbstractFileByPath(p)) continue;
      files.push({ name: rest.slice(0, -3), path: p });
    }
    return { folders: [...folders].map(([name, path]) => ({ name, path })), files };
  }

  /** how many shared files under a folder are not here yet */
  remoteCount(folder: string): number {
    const prefix = folder.endsWith("/") ? folder : `${folder}/`;
    let n = 0;
    for (const p of this.manifestPaths) if (p.startsWith(prefix) && !this.s.app.vault.getAbstractFileByPath(p)) n++;
    return n;
  }

  /** the shared path for a page name ("1 Nephi 12 - Study Guide"), or a path as given */
  pathFor(nameOrPath: string): string | null {
    if (this.s.app.vault.getAbstractFileByPath(nameOrPath)) return nameOrPath;
    const want = nameOrPath.endsWith(".md") ? nameOrPath : `${nameOrPath}.md`;
    if (want.includes("/")) return this.manifestPaths.includes(want) ? want : null;
    const hit = this.manifestPaths.find(p => p.endsWith(`/${want}`));
    return hit ?? null;
  }

  /** one page, now: fetched, written, pinned so later runs keep it fresh.
   * Resolves once Obsidian knows the file (or gives up after a moment). */
  async fetchNow(path: string): Promise<boolean> {
    if (!this.s.device.deviceToken) return false;
    if (await this.isSource()) return false;
    const adapter = this.s.app.vault.adapter;
    try {
      const { files } = await this.s.api.vaultBatch([path]);
      const f = files.find(x => x.p === path && !x.missing);
      if (!f) return false;
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (dir) {
        const parts = dir.split("/");
        for (let i = 1; i <= parts.length; i++) {
          const d = parts.slice(0, i).join("/");
          if (!(await adapter.exists(normalizePath(d)))) { try { await adapter.mkdir(normalizePath(d)); } catch { /* raced */ } }
        }
      }
      if (f.text !== undefined) await adapter.write(normalizePath(path), f.text);
      else if (f.b64 !== undefined) await adapter.writeBinary(normalizePath(path), b64ToBytes(f.b64));
      const index = (await this.s.store.get<Index>(INDEX_KEY)) ?? {};
      index[path] = f.h ?? "";
      await this.s.store.put(INDEX_KEY, index);
      const prefs = syncPrefs(this.s);
      if (!this.wanted(path, prefs)) {
        const d = this.s.device as { sync?: Partial<SyncPrefs> };
        d.sync = { ...(d.sync ?? {}), pins: [...prefs.pins, path] };
        await this.s.saveDevice();
      }
      for (let i = 0; i < 30; i++) {
        if (this.s.app.vault.getAbstractFileByPath(path)) return true;
        await new Promise(r => window.setTimeout(r, 100));
      }
      return true;
    } catch (e) {
      trace("lazy.fail", { path, err: String((e as Error)?.message ?? e).slice(0, 80) });
      return false;
    }
  }

  /** keep a whole folder from now on (and fetch it): a shelf downloaded for offline */
  async pinFolder(folder: string): Promise<void> {
    const prefix = folder.endsWith("/") ? folder : `${folder}/`;
    const prefs = syncPrefs(this.s);
    if (!prefs.pins.includes(prefix)) {
      const d = this.s.device as { sync?: Partial<SyncPrefs> };
      d.sync = { ...(d.sync ?? {}), pins: [...prefs.pins, prefix] };
      await this.s.saveDevice();
    }
    this.set({ lastVersion: null });
    await this.run("manual");
  }

  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } }
  private set(patch: Partial<SyncStatus>): void { Object.assign(this.status, patch); this.emit(); }

  /** the engine's own machine holds the shared tree already */
  async isSource(): Promise<boolean> {
    if (this.source === null) this.source = await this.s.app.vault.adapter.exists(".scripture-engine/config/config.yaml");
    return this.source;
  }

  start(): void {
    const p = syncPrefs(this.s);
    void this.loadManifestCache();
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
    for (const pin of prefs.pins) if (path === pin || path.startsWith(pin)) return true;
    if (NEVER_ON_PHONES.includes(path)) return false;
    for (const sec of SECTIONS) {
      if (sec.prefixes.some(pre => path.startsWith(pre))) return sectionOn(sec, prefs);
    }
    return true;   // everything outside the optional shelves comes along
  }

  private async syncShared(): Promise<void> {
    const prefs = syncPrefs(this.s);
    const api = this.s.api;
    const v = await api.vaultVersion();
    const index = (await this.s.store.get<Index>(INDEX_KEY)) ?? {};
    // the rules changed shape (an update): every file is decided again
    if ((await this.s.store.get<number>(RULES_KEY)) !== RULES) { this.status.lastVersion = null; await this.s.store.put(RULES_KEY, RULES); }
    await this.loadManifestCache();
    if (v.version === this.status.lastVersion && Object.keys(index).length && this.manifestPaths.length) return;
    this.set({ phase: "manifest" });
    const m = await api.vaultManifest();
    this.manifestPaths = m.files.map(f => f.p);
    await this.s.store.put(MANIFEST_KEY, { version: m.version, paths: this.manifestPaths });
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
