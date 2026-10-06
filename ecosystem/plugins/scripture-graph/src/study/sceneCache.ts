import { requestUrl, type DataAdapter } from 'obsidian';
import { SCENE_CATALOG, type SceneAsset } from './sceneCatalog';

interface Entry { bytes: number; used: number; }
interface Index { entries: Record<string, Entry>; pins: string[]; }
// A phone keyboard must not turn a portrait scene into a desktop download.
export const wideScene = (width: number, height: number) => width >= 800 && width > height;
export function evictionPlan(entries: Record<string, Entry>, pinned: Set<string>, incoming: number, limit: number): string[] {
  let bytes = Object.values(entries).reduce((sum, entry) => sum + entry.bytes, 0) + incoming;
  const remove: string[] = [];
  for (const [key, entry] of Object.entries(entries).sort((a,b) => a[1].used-b[1].used)) {
    if (bytes <= limit) break;
    if (!pinned.has(key)) { remove.push(key); bytes -= entry.bytes; }
  }
  if (bytes > limit) throw new Error('Offline favorites fill this limit. Unpin a scene or increase scene storage.');
  return remove;
}

/** Only catalogued image files in this plugin's cache are managed here. */
export class SceneCache {
  private index: Index = { entries: {}, pins: [] };
  private ready = false;
  private queue: Promise<unknown> = Promise.resolve();
  private assets = new Map<string, SceneAsset>();
  constructor(private adapter: DataAdapter, private dir: string, private limitMB: () => number) {
    for (const row of Object.values(SCENE_CATALOG)) for (const asset of [row.portrait, row.wide]) if(asset) this.assets.set(asset.file,asset);
  }
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => { await this.init(); return fn(); });
    this.queue = next.catch(() => {}); return next;
  }
  private async init() {
    if(this.ready) return;
    if(!await this.adapter.exists(this.dir)) await this.adapter.mkdir(this.dir);
    try { const data = JSON.parse(await this.adapter.read(`${this.dir}/index.json`)); if(Array.isArray(data.pins)) this.index.pins=data.pins.filter((id: unknown)=>typeof id==='string' && !!SCENE_CATALOG[id]); } catch { /* new or damaged index */ }
    let saved: Record<string, Entry> = {};
    try { saved=JSON.parse(await this.adapter.read(`${this.dir}/index.json`)).entries ?? {}; } catch { /* rebuild from image files */ }
    const listing=await this.adapter.list(this.dir);
    for(const path of listing.files) {
      const name=path.slice(path.lastIndexOf('/')+1);
      if(/^[a-z0-9-]+-(portrait|wide)-[a-f0-9]{16}\.jpg$/.test(name)&&!this.assets.has(name))await this.adapter.remove(`${this.dir}/${name}`);
    }
    for(const [file, asset] of this.assets) {
      const stat=await this.adapter.stat(`${this.dir}/${file}`);
      if(stat?.type==='file' && stat.size===asset.bytes) this.index.entries[file]={bytes:stat.size, used:Number.isFinite(saved[file]?.used)?saved[file]!.used:0};
    }
    this.ready=true;
  }
  private save() { return this.adapter.write(`${this.dir}/index.json`,JSON.stringify(this.index)); }
  private pinnedFiles(extra?: string) {
    const keys=new Set<string>(extra?[extra]:[]);
    for(const id of this.index.pins) { const row=SCENE_CATALOG[id]; if(row){keys.add(row.portrait.file); if(row.wide)keys.add(row.wide.file);} }
    return keys;
  }
  private async trim(incoming=0, protect?: string, limit=this.limitMB()) {
    const remove=evictionPlan(this.index.entries,this.pinnedFiles(protect),incoming,limit*1_000_000);
    for(const file of remove){await this.adapter.remove(`${this.dir}/${file}`);delete this.index.entries[file];}
    await this.save();
  }
  get(id: string, wide: boolean): Promise<string> { return this.run(()=>this.fetch(id,wide)); }
  private async fetch(id: string, wide: boolean): Promise<string> {
    const row=SCENE_CATALOG[id]; if(!row)throw new Error('Unknown scene');
    const asset=(wide&&row.wide)||row.portrait;
    if(this.index.entries[asset.file] && await this.adapter.exists(`${this.dir}/${asset.file}`)) {
      this.index.entries[asset.file]!.used=Date.now(); await this.trim(0,asset.file);
      return this.adapter.getResourcePath(`${this.dir}/${asset.file}`);
    }
    delete this.index.entries[asset.file];
    // Check capacity before downloading. Never evict anything until bytes are verified.
    evictionPlan(this.index.entries,this.pinnedFiles(),asset.bytes,this.limitMB()*1_000_000);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const response=await Promise.race([requestUrl({url:asset.url,method:'GET',throw:false}), new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Scene download timed out. Try again when connected.')),30_000);})]).finally(()=>clearTimeout(timer));
    if(response.status!==200)throw new Error('Scene unavailable. Your offline starter scene is still available.');
    const bytes=response.arrayBuffer;
    if(bytes.byteLength!==asset.bytes || bytes.byteLength>5_000_000)throw new Error('Scene download did not match its expected size.');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
    if(hash!==asset.sha256)throw new Error('Scene download failed verification.');
    await this.trim(asset.bytes);
    await this.adapter.writeBinary(`${this.dir}/${asset.file}`,bytes);
    this.index.entries[asset.file]={bytes:asset.bytes,used:Date.now()};await this.save();
    return this.adapter.getResourcePath(`${this.dir}/${asset.file}`);
  }
  status() { return this.run(async()=>({bytes:Object.values(this.index.entries).reduce((n,e)=>n+e.bytes,0),pins:[...this.index.pins],count:Object.keys(this.index.entries).length})); }
  pin(id: string, keep: boolean, wide: boolean) { return this.run(async()=>{
    if(!SCENE_CATALOG[id])throw new Error('Unknown scene');
    if(keep)await this.fetch(id,wide);
    this.index.pins=this.index.pins.filter(value=>value!==id);if(keep)this.index.pins.push(id);await this.save();
  }); }
  setLimit(mb: number) { return this.run(async()=>{ if(![25,50,100,250].includes(mb))throw new Error('Invalid storage limit');await this.trim(0,undefined,mb); }); }
  clearUnused() { return this.run(async()=>{for(const file of Object.keys(this.index.entries))if(!this.pinnedFiles().has(file)){await this.adapter.remove(`${this.dir}/${file}`);delete this.index.entries[file];}await this.save();}); }
}
