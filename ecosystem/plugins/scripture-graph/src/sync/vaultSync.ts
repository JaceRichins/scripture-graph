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
import { Notice, Platform, TFile, normalizePath } from "obsidian";
import { refreshIdentity } from "../social/identity";
import { SGState } from "../state";
import { trace } from "../study/trace";
import { sharedCache } from "./sharedCache";
import { essential, pinMatches, recentConference, removeCachedCopy, stale, type Usage } from './retention';

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
  { key: "topics", label: "Gospel Topics, doctrines, people, places, events, Come Follow Me", prefixes: ["AI Library/0"], defaultOn: false },
  { key: "conference", label: "General Conference (2,900 talks)", prefixes: ["AI Library/10 General Conference/"], defaultOn: false },
  { key: "family", label: "Family (ancestors, their records, photos and stories)", prefixes: ["AI Library/12 Family/"], defaultOn: false },
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
  return !!sec.always || (prefs.sections[sec.key] ?? sec.defaultOn ?? false);
}

export interface SyncPrefs {
  enabled: boolean; sections: Record<string, boolean>; intervalMin: number;
  /** paths and folder prefixes kept regardless of section switches: pages
   * opened on demand, shelves downloaded from the Library */
  pins: string[];
  pruneDays: number;
}
export const DEFAULT_SYNC: SyncPrefs = { enabled: true, sections: {}, intervalMin: 30, pins: [], pruneDays: 30 };

/** bumped when the rules above change shape: the next run re-decides every file */
const RULES = 6;
const USAGE_KEY = 'vaultsync:usage-v1';
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

/** Verify the response bytes before touching a good local copy or its index. */
async function verifiedBytes(file: { text?: string; b64?: string; h?: string }): Promise<ArrayBuffer> {
  const bytes = file.text !== undefined ? new TextEncoder().encode(file.text).buffer
    : file.b64 !== undefined ? b64ToBytes(file.b64) : null;
  if (!bytes || !file.h) throw new Error('Library download is incomplete; retry when connected.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
  if (hash !== file.h) throw new Error('Library download failed verification; retry when connected.');
  return bytes;
}

export class VaultSync {
  status: SyncStatus = { running: false, phase: "idle", done: 0, total: 0, lastRun: null, lastVersion: null,
    lastError: null, files: 0, personalPushed: 0, personalPulled: 0, conflicts: 0 };
  listeners: (() => void)[] = [];
  private timer: number | null = null;
  private startupTimer: number | null = null;
  private activeRun: Promise<void> | null = null;
  private dirty = new Set<string>();
  private dirtyTimer: number | null = null;
  private source: boolean | null = null;
  /** every shared path the server offers (the last manifest), for shelves
   * that list what is not downloaded yet and for opening it on demand */
  private manifestPaths: string[] = [];
  private manifestLoaded = false;
  private catalogRefresh: Promise<void> | null = null;
  private catalogVersion: string | null = null;
  private indexWrite: Promise<void> = Promise.resolve();
  private sharedWork: Promise<unknown> = Promise.resolve();
  private usage: Usage = {};
  private usageLoaded = false;
  private usageTimer: number | null = null;
  private held = new Set<string>();
  private manifestHashes: Index = {};
  private lastPrune = 0;

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const work = this.sharedWork.then(fn); this.sharedWork = work.catch(() => {}); return work;
  }

  private async loadUsage(): Promise<void> {
    if (this.usageLoaded) return;
    this.usage = { ...((await this.cache.get<Usage>(USAGE_KEY)) ?? {}), ...this.usage };
    this.usageLoaded = true;
    // Older releases used exact-file pins for every lazy read. Folder pins
    // alone represented a deliberate offline choice.
    const prefs = syncPrefs(this.s);
    if (prefs.pins.some(p => !p.endsWith('/'))) {
      this.s.device.sync = { ...this.s.device.sync, pins: prefs.pins.filter(p => p.endsWith('/')) };
      await this.s.saveDevice();
    }
  }

  recordAccess(path: string): void {
    if (!path.startsWith('AI Library/') && !path.startsWith('_media/')) return;
    this.usage[path] = { used: Date.now() };
    // Keep pictures used by a recently opened page on the same schedule.
    for (const target of Object.keys(this.s.app.metadataCache.resolvedLinks[path] ?? {})) {
      if (!target.endsWith('.md')) this.usage[target] = { used: Date.now() };
    }
    if (this.usageTimer) window.clearTimeout(this.usageTimer);
    this.usageTimer = window.setTimeout(() => {
      this.usageTimer = null;
      void this.exclusive(async () => { await this.loadUsage(); await this.cache.put(USAGE_KEY, this.usage); }).catch(() => {});
    }, 1000);
  }

  private cache: ReturnType<typeof sharedCache>;
  constructor(private s: SGState, private deviceName: () => string) {
    this.cache = sharedCache(s.store, (s.app as unknown as { appId?: string }).appId ?? "vault");
  }

  private async loadManifestCache(): Promise<void> {
    if (this.manifestLoaded) return;
    const m = await this.cache.get<{ version: string; paths: string[] }>(MANIFEST_KEY);
    if (m?.paths?.length && !this.catalogVersion) {
      this.manifestPaths = m.paths;
      this.catalogVersion = m.version;
      this.catalogChanged();
    }
    this.manifestLoaded = true;
  }

  private catalogChanged(): void {
    if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("sg-library-catalog-changed"));
  }

  get catalogCount(): number { return this.manifestPaths.filter(p => p.endsWith('.md')).length; }

  private async acceptCatalog(m: { version: string; files: { p: string }[] }): Promise<void> {
    const changed = this.catalogVersion !== m.version;
    this.manifestPaths = m.files.map(f => f.p);
    this.manifestHashes = Object.fromEntries(m.files.map(f => [f.p, (f as { h?: string }).h ?? '']));
    this.catalogVersion = m.version;
    this.manifestLoaded = true;
    await this.cache.put(MANIFEST_KEY, { version: m.version, paths: this.manifestPaths });
    if (changed) this.catalogChanged();
  }

  /** Discover the shelves without downloading their files. First-use links
   * can resolve even before the scheduled offline-core sync has started. */
  async refreshCatalog(): Promise<void> {
    await this.loadManifestCache();
    if (!this.s.device.deviceToken) return;
    if (this.catalogRefresh) return this.catalogRefresh;
    const work = (async () => { await this.acceptCatalog(await this.s.api.vaultManifest()); })();
    this.catalogRefresh = work;
    try { await work; } finally { if (this.catalogRefresh === work) this.catalogRefresh = null; }
  }

  /** Lazy reads and background sync can finish together. Merge checkpoints
   * so neither drops the other's newly cached pages from future updates. */
  private async updateIndex(changes: Index, removed: string[] = []): Promise<void> {
    const snapshot = { ...changes };
    const work = this.indexWrite.then(async () => {
      const current = (await this.cache.get<Index>(INDEX_KEY)) ?? {};
      Object.assign(current, snapshot);
      for (const path of removed) delete current[path];
      await this.cache.put(INDEX_KEY, current);
    });
    this.indexWrite = work.catch(() => { /* later attempts may retry storage */ });
    await work;
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
      if (cut >= 0) { const name = rest.slice(0, cut); if (!name.startsWith("_") && !folders.has(name)) folders.set(name, prefix + name); continue; }
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
    const want = /\.[a-z0-9]{2,5}$/i.test(nameOrPath) ? nameOrPath : `${nameOrPath}.md`;
    if (want.includes("/")) return this.manifestPaths.includes(want) ? want : null;
    const hit = this.manifestPaths.find(p => p.endsWith(`/${want}`));
    return hit ?? null;
  }

  /** one page, now: fetched, written, pinned so later runs keep it fresh.
   * Resolves once Obsidian knows the file (or gives up after a moment). */
  async fetchNow(path: string): Promise<boolean> {
    return this.exclusive(() => this.fetchSharedNow(path));
  }

  private async fetchSharedNow(path: string): Promise<boolean> {
    if (path.split('/').some(part => part.startsWith('.'))) return false;
    if (!this.s.device.deviceToken) return false;
    if (await this.isSource()) return false;
    const adapter = this.s.app.vault.adapter;
    try {
      const { files } = await this.s.api.vaultBatch([path]);
      const f = files.find(x => x.p === path && !x.missing);
      if (!f) return false;
      const bytes = await verifiedBytes(f);
      const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
      if (dir) {
        const parts = dir.split("/");
        for (let i = 1; i <= parts.length; i++) {
          const d = parts.slice(0, i).join("/");
          if (!(await adapter.exists(normalizePath(d)))) { try { await adapter.mkdir(normalizePath(d)); } catch { /* raced */ } }
        }
      }
      if (f.text !== undefined) await adapter.write(normalizePath(path), f.text);
      else if (f.b64 !== undefined) await adapter.writeBinary(normalizePath(path), bytes);
      await this.updateIndex({ [path]: f.h ?? "" });
      await this.loadUsage();
      this.held.add(path);
      this.recordAccess(path);
      await this.cache.put(USAGE_KEY, this.usage);
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

  /** true at most once an hour, and only while this device holds no library
   * at all — the state a new member is stuck in and cannot see */
  private silentFailureAt = 0;
  private reportSilentFailure(): boolean {
    if (this.status.files > 0) return false;
    if (Date.now() - this.silentFailureAt < 3600_000) return false;
    this.silentFailureAt = Date.now();
    return true;
  }

  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } }
  private set(patch: Partial<SyncStatus>): void { Object.assign(this.status, patch); this.emit(); }

  /** the engine's own machine holds the shared tree already */
  async isSource(): Promise<boolean> {
    // A copied engine marker must never turn a family phone into the server.
    if (Platform.isMobile) return false;
    if (this.source === null) this.source = await this.s.app.vault.adapter.exists(".scripture-engine/config/config.yaml");
    return this.source;
  }

  start(): void {
    const p = syncPrefs(this.s);
    void this.loadManifestCache().catch(() => { /* the foreground run reports and retries storage errors */ });
    this.stop();
    if (!this.s.device.deviceToken) return;
    // Browsing the server catalog is independent of keeping files offline.
    void this.refreshCatalog().catch(() => {});
    if (!p.enabled) return;
    this.startupTimer = window.setTimeout(() => { this.startupTimer = null; void this.run("startup"); }, 4_000);
    this.timer = window.setInterval(() => void this.run("interval"), Math.max(5, p.intervalMin) * 60_000);
  }

  /** back in the app after a while: check now rather than waiting out a timer
   * that was not running while the phone was asleep */
  catchUp(): void {
    const prefs = syncPrefs(this.s);
    if (!this.s.device.deviceToken || !prefs.enabled || this.status.running) return;
    const last = this.status.lastRun ? Date.parse(this.status.lastRun) : 0;
    if (Date.now() - last < Math.max(5, prefs.intervalMin) * 60_000) return;
    void this.run("foreground");
  }

  stop(): void {
    if (this.timer) { window.clearInterval(this.timer); this.timer = null; }
    if (this.startupTimer) { window.clearTimeout(this.startupTimer); this.startupTimer = null; }
    if (this.usageTimer) {
      window.clearTimeout(this.usageTimer); this.usageTimer = null;
      void this.exclusive(async () => { await this.loadUsage(); await this.cache.put(USAGE_KEY, this.usage); }).catch(() => {});
    }
  }

  /** a personal file changed here — push soon (debounced) */
  noteChanged(path: string): void {
    if (!path.startsWith("Library/")) return;
    this.dirty.add(path);
    if (this.dirtyTimer) window.clearTimeout(this.dirtyTimer);
    this.dirtyTimer = window.setTimeout(() => void this.pushPersonal(), 2_500);
  }

  async run(reason: string): Promise<void> {
    // A reconnect must wait for existing work and then check again using the
    // newly selected server/shelves. Never report success while still copying.
    while (this.activeRun) {
      await this.activeRun;
      if (reason !== "manual" && reason !== "live" && reason !== "foreground") return;
    }
    const work = this.runOnce(reason);
    this.activeRun = work;
    try { await work; } finally { if (this.activeRun === work) this.activeRun = null; }
  }

  private async runOnce(reason: string): Promise<void> {
    if (reason !== "manual" && !syncPrefs(this.s).enabled) return;
    if (!this.s.device.deviceToken) { this.set({ lastError: "not signed in" }); return; }
    this.set({ running: true, phase: "checking", lastError: null, done: 0, total: 0 });
    try {
      // Undo the 0.72.98 full-download preset if it was used. This exact
      // all-on signature was generated by that button; keep page/folder pins.
      if (SECTIONS.every(section => this.s.device.sync?.sections?.[section.key] === true)) {
        this.s.device.sync = { ...this.s.device.sync, sections: {} };
        await this.s.saveDevice();
        this.status.lastVersion = null;
      }
      // Shared reading downloads must not block the user's personal notes.
      let libraryError: string | null = null;
      const shared = async () => {
        if (await this.isSource()) return;
        await this.exclusive(async () => {
          await this.syncShared(reason === "manual");
          await this.pruneDownloads();
        });
      };
      try { await shared(); }
      catch (e) {
        // The laptop's address changes whenever its tunnel restarts, which
        // silently strands every phone holding the old one. Find out where it
        // is answering now and finish the sync, rather than failing for days.
        let recovered: string | null = null;
        try { recovered = await this.s.rediscoverServer(); } catch { /* still unreachable */ }
        if (recovered) {
          this.set({ phase: "reconnecting" });
          try { await shared(); }
          catch (again) { libraryError = `Library: ${String((again as Error)?.message ?? again)}`; }
        } else {
          libraryError = `Library: ${String((e as Error)?.message ?? e)}`;
        }
      }
      this.set({ lastError: libraryError });
      await this.pushPersonal();
      await this.pullPersonal();
      this.set({ running: false, phase: "idle", lastRun: new Date().toISOString() });
      // A failed background run used to be invisible: the reader just had an
      // empty library and no reason for it. Report the first one too.
      if (libraryError && (reason === "manual" || this.reportSilentFailure())) new Notice(`Sync: ${libraryError}`, 12000);
    } catch (e) {
      const error = String((e as Error)?.message ?? e);
      this.set({ running: false, phase: "idle", lastError: [this.status.lastError, error].filter(Boolean).join('; ') });
      if (reason === "manual") new Notice(`Sync: ${this.status.lastError}`);
    }
  }

  // ---------------------------------------------------------------- shared

  private wanted(path: string, prefs: SyncPrefs): boolean {
    // Plugin updates have their own coordinated channel. Never copy another
    // device's settings, caches, or partially published plugin via vault sync.
    if (path.split('/').some(part => part.startsWith('.'))) return false;
    if (path.startsWith('AI Library/00 System/') && !NEVER_ON_PHONES.includes(path)) return true;
    if (recentConference(path)) return true;
    if (/^AI Library\/12 Family\/(Family Tree|Family Stories|Family Narration)\.md$/.test(path)) return true;
    if (path.startsWith('AI Library/12 Family/_media/stories/')) {
      // A pre-existing "keep Family" pin must not silently gain hours of audio.
      // Only pins explicitly inside the recordings folder opt into that storage.
      if (prefs.pins.some(pin => pin.startsWith('AI Library/12 Family/_media/stories/') && pinMatches(path, pin))) return true;
      return !this.usage[path]?.pruned && this.held.has(path);
    }
    for (const pin of prefs.pins) if (pinMatches(path, pin)) return true;
    if (NEVER_ON_PHONES.includes(path)) return false;
    if (this.usage[path]?.pruned) return false;
    if (this.held.has(path)) return true;
    if (path.startsWith('_media/')) return path.startsWith('_media/covers/');
    for (const sec of SECTIONS) {
      if (sec.prefixes.some(pre => path.startsWith(pre))) return sectionOn(sec, prefs);
    }
    // New optional collections remain discoverable through the catalog.
    // Only explicit pins, retained reads and core sections download ahead.
    return false;
  }

  private async syncShared(repair = false): Promise<void> {
    const prefs = syncPrefs(this.s);
    const api = this.s.api;
    const v = await api.vaultVersion();
    const index = (await this.cache.get<Index>(INDEX_KEY)) ?? {};
    await this.loadUsage();
    this.held = new Set(Object.keys(index));
    // Existing installs have no trustworthy last-opened history. Give those
    // downloads a full retention window instead of guessing from file dates.
    for (const p of Object.keys(index)) this.usage[p] ??= { used: Date.now() };
    await this.cache.put(USAGE_KEY, this.usage);
    // the rules changed shape (an update): every file is decided again
    if ((await this.s.store.get<number>(RULES_KEY)) !== RULES) { this.status.lastVersion = null; await this.s.store.put(RULES_KEY, RULES); }
    await this.loadManifestCache();
    if (!repair && v.version === this.status.lastVersion && Object.keys(index).length && this.manifestPaths.length) {
      // The server being unchanged says nothing about files evicted or lost
      // on this device. Check the in-memory vault catalog before skipping.
      const missing = this.manifestPaths.some(p => this.wanted(p, prefs)
        && !this.s.app.vault.getAbstractFileByPath(p));
      if (!missing) return;
    }
    this.set({ phase: "manifest", lastVersion: null });
    const m = await api.vaultManifest();
    await this.acceptCatalog(m);
    const adapter = this.s.app.vault.adapter;
    const want = new Map<string, string>();
    for (const f of m.files) if (this.wanted(f.p, prefs)) want.set(f.p, f.h);
    // what to fetch: new, changed, or missing on disk
    const todo: string[] = [];
    for (const [p, h] of want) {
      if (index[p] !== h) { todo.push(p); continue; }
      if (!(await adapter.exists(normalizePath(p)))) todo.push(p);
    }
    // Make the reading pages available before downloading large records/media.
    todo.sort((a, b) => Number(!a.endsWith(".md")) - Number(!b.endsWith(".md")));
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
    const BATCH = 120, PARALLEL = Platform.isMobile ? 2 : 4;
    let cursor = 0;
    let failed = false;
    const worker = async () => {
      try { while (!failed && cursor < todo.length) {
        const chunk = todo.slice(cursor, cursor + BATCH);
        cursor += chunk.length;
        let response: Awaited<ReturnType<typeof api.vaultBatch>> | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { response = await api.vaultBatch(chunk); break; }
          catch (e) {
            if (attempt === 2) throw e;
            await new Promise(r => window.setTimeout(r, 1000 * (attempt + 1)));
          }
        }
        const files = response!.files;
        const got = new Set<string>();
        for (const f of files) {
          if (!chunk.includes(f.p) || got.has(f.p)) continue;
          if (f.missing || (f.text === undefined && f.b64 === undefined)) {
            throw new Error("A library file was unavailable. Tap reconnect to check again.");
          }
          await ensureFolder(f.p);
          const np = normalizePath(f.p);
          if (await adapter.exists(np)) {
            // An engine update must not overwrite a local edit before the
            // pruner gets its opportunity to recognize and protect that edit.
            const bytes = await adapter.readBinary(np);
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const localHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
            if (localHash !== index[f.p] && localHash !== f.h) { got.add(f.p); this.status.done++; continue; }
          }
          const verified = await verifiedBytes(f);
          if (f.text !== undefined) await adapter.write(np, f.text);
          else if (f.b64 !== undefined) await adapter.writeBinary(np, verified);
          // Use the bytes' actual hash if the source changed after its manifest.
          index[f.p] = f.h ?? want.get(f.p) ?? "";
          this.usage[f.p] ??= { used: Date.now() };
          got.add(f.p);
          this.status.done++;
        }
        // partial batch (size cap): ask again for what is still missing
        if (!got.size) throw new Error("The library download stopped. Tap reconnect to resume.");
        const rest = chunk.filter(p => !got.has(p));
        if (rest.length) todo.push(...rest);
        await this.updateIndex(index);
        this.emit();
      } } catch (e) { failed = true; throw e; }
    };
    // Keep the run locked until every writer stops, and checkpoint progress even
    // when one request fails. The next tap resumes instead of racing old writers.
    const results = await Promise.allSettled(Array.from({ length: Math.min(PARALLEL, Math.max(1, todo.length)) }, worker));
    await this.updateIndex(index);
    await this.cache.put(USAGE_KEY, this.usage);
    this.set({ files: Object.keys(index).length });
    const failure = results.find(r => r.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    this.set({ phase: "cleaning" });
    const removed: string[] = [];
    for (const p of gone) {
      if (this.manifestPaths.includes(p) && this.wanted(p, syncPrefs(this.s))) continue;
      const revoked = !this.manifestPaths.includes(p);
      if (!revoked && essential(p)) continue;
      const ok = await removeCachedCopy(p, index[p]!, {
        hash: async () => {
          const bytes = await adapter.readBinary(normalizePath(p));
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
        },
        stillEligible: () => !this.manifestPaths.includes(p) || (!essential(p) && !this.wanted(p, syncPrefs(this.s))),
        remove: () => adapter.remove(normalizePath(p)),
      });
      if (!ok) continue;
      delete index[p];
      removed.push(p);
    }
    await this.updateIndex(index, removed);
    if (removed.length) this.catalogChanged();
    this.set({ lastVersion: m.version, files: Object.keys(index).length });
  }

  // -------------------------------------------------------------- personal

  private async pruneDownloads(): Promise<void> {
    const prefs = syncPrefs(this.s);
    if (!Platform.isMobile || !prefs.pruneDays || Date.now() - this.lastPrune < 6 * 3600000) return;
    // A fresh authenticated catalog proves every candidate remains recoverable.
    await this.refreshCatalog();
    const index = (await this.cache.get<Index>(INDEX_KEY)) ?? {};
    const marks = (await this.s.sync.allAnnotations()).filter(a => !a.deleted_at);
    const anchors = new Set(marks.map(a => a.anchor_id?.split('#')[0]));
    const protectedFiles = new Set<string>();
    const localFiles = this.s.app.vault.getFiles();
    const byName = new Map<string, string[]>();
    for (const file of localFiles) {
      const name = file.path.split('/').pop()!;
      byName.set(name, [...(byName.get(name) ?? []), file.path]);
    }
    for (const file of localFiles) {
      const fm = this.s.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      if (file.path.startsWith('Library/') || anchors.has(`node:${file.basename}`) || anchors.has(`doc:${file.path}`)
          || [fm['sg-id'], fm.doc_id].some(id => typeof id === 'string' && (anchors.has(id) || anchors.has(`doc:${id}`)))) {
        protectedFiles.add(file.path);
        for (const target of Object.keys(this.s.app.metadataCache.resolvedLinks[file.path] ?? {})) protectedFiles.add(target);
        // Personal attachments remain protected even while Obsidian is still
        // rebuilding its link cache after launch. A failed read aborts cleanup.
        if (file.path.endsWith('.md')) {
          const text = await this.s.app.vault.adapter.read(file.path);
          for (const match of text.matchAll(/\[\[([^\]|#]+)(?:[^\]]*)\]\]|\]\(([^)]+)\)/g)) {
            let target = match[1] ?? match[2]!;
            try { target = decodeURIComponent(target); } catch { /* literal path */ }
            const name = target.split(/[\\/]/).pop()!.split('#')[0]!;
            for (const path of [...(byName.get(name) ?? []), ...(byName.get(name + '.md') ?? [])]) protectedFiles.add(path);
          }
        }
      }
    }
    const active = this.s.app.workspace.getActiveFile(); if (active) protectedFiles.add(active.path);
    this.s.app.workspace.iterateAllLeaves(leaf => {
      const state = leaf.view.getState();
      for (const value of [state.file, state.path]) if (typeof value === 'string') protectedFiles.add(value);
    });
    const eligible = (p: string) => stale(p, this.usage, prefs.pruneDays)
      && this.manifestHashes[p] === index[p] && !protectedFiles.has(p)
      && !prefs.pins.some(pin => pinMatches(p, pin))
      && !SECTIONS.some(sec => prefs.sections[sec.key] === true && sec.prefixes.some(pre => p.startsWith(pre)));
    const removed: string[] = [];
    let pending: string[] = [];
    const started = Date.now();
    let limited = false;
    const checkpoint = async () => {
      if (!pending.length) return;
      await this.cache.put(USAGE_KEY, this.usage);
      await this.updateIndex({}, pending);
      pending = [];
    };
    for (const p of Object.keys(index)) {
      if (!eligible(p)) continue;
      if (removed.length >= 500 || Date.now() - started > 15000) { limited = true; break; }
      const ok = await removeCachedCopy(p, index[p]!, {
        hash: async () => {
          const bytes = await this.s.app.vault.adapter.readBinary(normalizePath(p));
          const hash = await crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
        },
        stillEligible: () => eligible(p),
        remove: () => this.s.app.vault.adapter.remove(normalizePath(p)),
      });
      if (ok) {
        this.usage[p] = { ...this.usage[p]!, pruned: true };
        this.held.delete(p); removed.push(p); pending.push(p);
        // Batch checkpoints avoid rewriting the entire device index once per
        // photo. Tombstones are saved before ownership is forgotten.
        if (pending.length >= 25) await checkpoint();
      }
    }
    await checkpoint();
    this.lastPrune = limited ? 0 : Date.now();
    if (removed.length) { this.catalogChanged(); this.set({ files: Object.keys(index).length - removed.length }); }
  }

  private async personalIndex(): Promise<PIndex> { return (await this.s.store.get<PIndex>(PINDEX_KEY)) ?? {}; }

  private async listLocalPersonal(): Promise<string[]> {
    return this.s.app.vault.getFiles().filter(f => f.path.startsWith("Library/") && f.extension === "md").map(f => f.path);
  }

  async pushPersonal(): Promise<void> {
    if (!this.s.device.deviceToken) return;
    await refreshIdentity(this.s, true);
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
    await refreshIdentity(this.s, true);
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
    // Preserve ownership and downloaded hashes so changing a shelf resumes a
    // diff, rather than forgetting every file and downloading it all again.
    this.set({ lastVersion: null });
    this.lastPrune = 0;
  }
}
