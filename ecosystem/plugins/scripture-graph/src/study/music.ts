/** The music player — one queue, one mini bar above the dock, the way a
 * streaming app does it. Hymns and Primary songs stream from the Church's
 * recordings; anything the Church does not serve opens in the listener's
 * own service (Spotify, Apple Music, YouTube), chosen once. */
import { App, Menu, Modal, Notice, Setting } from "obsidian";

export type Service = "spotify" | "apple" | "youtube";
export const SERVICES: { key: Service; label: string }[] = [
  { key: "spotify", label: "Spotify" }, { key: "apple", label: "Apple Music" }, { key: "youtube", label: "YouTube" },
];

export function serviceUrl(service: Service, query: string): string {
  const q = encodeURIComponent(query);
  return service === "spotify" ? `https://open.spotify.com/search/${q}`
    : service === "apple" ? `https://music.apple.com/us/search?term=${q}`
      : `https://www.youtube.com/results?search_query=${q}`;
}

export interface PlayItem {
  id: string;
  title: string;
  /** "Hymn 85 · Church recording" */
  sub: string;
  /** the stream; absent = plays elsewhere (searchQuery) */
  url?: string;
  alt?: { label: string; url: string }[];       // e.g. accompaniment
  searchQuery: string;
  wordsUrl?: string;
  /** cover art resource path for the bar */
  art?: string;
  /** where the bar's title leads */
  open?: () => void;
}

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  queue: PlayItem[] = [];
  index = -1;
  paused = false;
  private bar: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private listeners = new Set<() => void>();

  constructor(private app: App, private prefs: { get(): Service | null; set(s: Service): Promise<void> }) {}

  on(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } this.paint(); }

  current(): PlayItem | null { return this.queue[this.index] ?? null; }
  isCurrent(id: string): boolean { return this.current()?.id === id; }
  get playing(): boolean { return !!this.audio && !this.paused; }

  /** tap on a row: play here when the Church serves it, else open elsewhere */
  play(queue: PlayItem[], index: number): void {
    const it = queue[index];
    if (!it) return;
    if (!it.url) { void this.openElsewhere(it); return; }
    this.queue = queue;
    this.index = index;
    this.start(it.url);
  }

  /** the big Play button: everything in the list that plays here, in order */
  playAll(queue: PlayItem[], shuffle = false): void {
    let q = queue.filter(i => i.url);
    if (!q.length) { new Notice("Nothing in this list plays here — tap a song to open it elsewhere."); return; }
    if (shuffle) q = q.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    this.queue = q; this.index = 0;
    this.start(q[0]!.url!);
  }

  /** play a specific stream of the current item (accompaniment) */
  playUrl(it: PlayItem, url: string): void {
    if (!this.isCurrent(it.id)) { this.queue = [it]; this.index = 0; }
    this.start(url);
  }

  toggle(): void {
    if (!this.audio) return;
    if (this.paused) { void this.audio.play(); this.paused = false; }
    else { this.audio.pause(); this.paused = true; }
    this.emit();
  }

  next(): void { this.step(1); }
  prev(): void {
    if (this.audio && this.audio.currentTime > 4) { this.audio.currentTime = 0; return; }
    this.step(-1);
  }

  private step(d: number): void {
    let i = this.index + d;
    while (this.queue[i] && !this.queue[i]!.url) i += d;
    if (!this.queue[i]) { this.stop(); return; }
    this.index = i;
    this.start(this.queue[i]!.url!);
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.queue = []; this.index = -1; this.paused = false;
    document.body.removeClass("sg-player-on");
    this.emit();
  }

  private start(url: string): void {
    this.audio?.pause();
    const a = new Audio(url);
    this.audio = a; this.paused = false;
    a.onended = () => { if (this.audio === a) this.step(1); };
    a.onerror = () => { if (this.audio === a) { new Notice("That recording would not play."); this.step(1); } };
    a.ontimeupdate = () => { if (this.audio === a && this.progress && a.duration) this.progress.style.width = `${(a.currentTime / a.duration) * 100}%`; };
    void a.play().catch(() => new Notice("Tap again to start playback."));
    document.body.addClass("sg-player-on");
    this.emit();
  }

  /** the listener's service, asked for once */
  async service(): Promise<Service | null> {
    const s = this.prefs.get();
    if (s) return s;
    return new Promise(resolve => {
      const m = new Modal(this.app);
      let done = false;
      m.contentEl.addClass("sg-welcome");
      m.contentEl.createEl("h3", { text: "Where do you listen?" });
      m.contentEl.createEl("p", { text: "Songs the Church doesn't record open in your own music app. You can change this any time from a song's ⋯ menu." });
      for (const sv of SERVICES) {
        new Setting(m.contentEl).addButton(b => b.setButtonText(sv.label).setCta().onClick(async () => {
          await this.prefs.set(sv.key); done = true; m.close(); resolve(sv.key);
        }));
      }
      m.onClose = () => { m.contentEl.empty(); if (!done) resolve(null); };
      m.open();
    });
  }

  async openElsewhere(it: PlayItem, service?: Service): Promise<void> {
    const s = service ?? await this.service();
    if (!s) return;
    window.open(serviceUrl(s, it.searchQuery), "_blank");
  }

  /** the ⋯ on a row */
  menu(it: PlayItem, ev: MouseEvent): void {
    const m = new Menu();
    if (it.url) m.addItem(i => i.setTitle("Play here").setIcon("play").onClick(() => this.play([it], 0)));
    for (const a of it.alt ?? []) m.addItem(i => i.setTitle(a.label).setIcon("music").onClick(() => this.playUrl(it, a.url)));
    if (it.url || it.alt?.length) m.addSeparator();
    for (const sv of SERVICES) m.addItem(i => i.setTitle(`Open in ${sv.label}`).setIcon("external-link").onClick(() => void this.openElsewhere(it, sv.key)));
    if (it.wordsUrl) m.addItem(i => i.setTitle("Words & sheet music").setIcon("file-text").onClick(() => window.open(it.wordsUrl!, "_blank")));
    m.addSeparator();
    m.addItem(i => i.setTitle("Change my music app…").setIcon("settings").onClick(async () => {
      await this.prefs.set(null as unknown as Service); await this.service();
    }));
    m.showAtMouseEvent(ev);
  }

  // ------------------------------------------------------------- the bar
  mount(): void {
    if (this.bar) return;
    const bar = document.body.createDiv({ cls: "sg-player" });
    this.bar = bar;
    this.paint();
  }

  destroy(): void { this.stop(); this.bar?.remove(); this.bar = null; }

  private paint(): void {
    const bar = this.bar;
    if (!bar) return;
    bar.empty();
    const it = this.current();
    if (!it || !this.audio) { bar.hide(); return; }
    bar.show();
    const line = bar.createDiv({ cls: "sg-player-line" });
    this.progress = line.createDiv({ cls: "sg-player-prog" });
    if (it.art) { const img = bar.createEl("img", { cls: "sg-player-art" }); img.src = it.art; }
    const meta = bar.createDiv({ cls: "sg-player-meta" });
    meta.createDiv({ cls: "sg-player-title", text: it.title });
    meta.createDiv({ cls: "sg-player-sub", text: it.sub });
    if (it.open) meta.onclick = it.open;
    const btn = (label: string, cls: string, fn: () => void) => {
      const b = bar.createEl("button", { cls: `sg-player-btn ${cls}`, text: label });
      b.onclick = (e) => { e.stopPropagation(); fn(); };
    };
    btn("⏮", "", () => this.prev());
    btn(this.paused ? "▶" : "⏸", "sg-player-main", () => this.toggle());
    btn("⏭", "", () => this.next());
    btn("✕", "sg-player-x", () => this.stop());
  }
}
