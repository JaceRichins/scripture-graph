/** The music player — one queue, one mini bar above the dock, the way a
 * streaming app does it. Three engines behind one set of controls:
 *
 *   audio    — a free stream (the Church's hymn recordings; public-domain
 *              performances from Commons), played by the app itself
 *   spotify  — the listener's Spotify app plays, we drive it (Premium)
 *   youtube  — YouTube's own embedded player, visible above the bar
 *
 * Anything none of those can reach opens in the listener's music app. */
import { App, Menu, Modal, Notice, Setting } from "obsidian";
import type { Spotify } from "./spotify";

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
  /** a free stream; absent = another engine or elsewhere */
  url?: string;
  /** a YouTube video id, for the embedded player */
  yt?: string;
  alt?: { label: string; url: string }[];
  searchQuery: string;
  wordsUrl?: string;
  credit?: string;
  art?: string;
  open?: () => void;
  /** playlists: a performance (Spotify, the Choir on YouTube) beats the plain recording */
  preferVideo?: boolean;
}

type Mode = "audio" | "spotify" | "youtube";

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private mode: Mode | null = null;
  queue: PlayItem[] = [];
  index = -1;
  paused = false;
  private bar: HTMLElement | null = null;
  private video: HTMLElement | null = null;
  private frame: HTMLIFrameElement | null = null;
  private progress: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private spotifyPoll: number | null = null;
  private spotifyUri: string | null = null;
  private spotifySeen = false;

  constructor(private app: App, private prefs: { get(): Service | null; set(s: Service | null): Promise<void> },
    public spotify: Spotify) {
    window.addEventListener("message", this.onFrameMessage);
  }

  on(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } this.paint(); }

  current(): PlayItem | null { return this.queue[this.index] ?? null; }
  isCurrent(id: string): boolean { return this.current()?.id === id; }
  get playing(): boolean { return this.mode !== null && !this.paused; }
  get active(): boolean { return this.mode !== null; }

  /** how this item would play, if tapped */
  engineFor(it: PlayItem): Mode | null {
    if (it.preferVideo) {
      if (this.spotify.connected) return "spotify";
      if (it.yt) return "youtube";
      return it.url ? "audio" : null;
    }
    if (it.url) return "audio";
    if (this.spotify.connected) return "spotify";
    if (it.yt) return "youtube";
    return null;
  }
  canPlay(it: PlayItem): boolean { return this.engineFor(it) !== null; }

  /** tap on a row */
  play(queue: PlayItem[], index: number): void {
    const it = queue[index];
    if (!it) return;
    if (!this.canPlay(it)) { void this.openElsewhere(it); return; }
    this.queue = queue;
    this.index = index;
    void this.start(it);
  }

  /** the big Play button: everything in the list that plays here, in order */
  playAll(queue: PlayItem[], shuffle = false): void {
    let q = queue.filter(i => this.canPlay(i));
    if (!q.length) { new Notice("Nothing in this list plays here — tap a song to open it in your music app."); return; }
    if (shuffle) q = q.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    this.queue = q; this.index = 0;
    void this.start(q[0]!);
  }

  /** a specific stream of the item (accompaniment) */
  playUrl(it: PlayItem, url: string): void {
    if (!this.isCurrent(it.id)) { this.queue = [it]; this.index = 0; }
    void this.start({ ...it, url });
  }

  toggle(): void {
    if (!this.mode) return;
    const resume = this.paused;
    this.paused = !this.paused;
    if (this.mode === "audio" && this.audio) { if (resume) void this.audio.play(); else this.audio.pause(); }
    else if (this.mode === "youtube") this.frameCmd(resume ? "playVideo" : "pauseVideo");
    else if (this.mode === "spotify") { if (resume) void this.spotify.resume(); else void this.spotify.pause(); }
    this.emit();
  }

  next(): void { this.step(1); }
  prev(): void {
    if (this.mode === "audio" && this.audio && this.audio.currentTime > 4) { this.audio.currentTime = 0; return; }
    this.step(-1);
  }

  private step(d: number): void {
    let i = this.index + d;
    while (this.queue[i] && !this.canPlay(this.queue[i]!)) i += d;
    if (!this.queue[i]) { this.stop(); return; }
    this.index = i;
    void this.start(this.queue[i]!);
  }

  stop(): void {
    this.teardownEngines();
    this.queue = []; this.index = -1; this.paused = false; this.mode = null;
    document.body.removeClass("sg-player-on");
    this.emit();
  }

  private teardownEngines(): void {
    this.audio?.pause(); this.audio = null;
    if (this.frame) { this.frame.remove(); this.frame = null; }
    this.video?.hide();
    if (this.spotifyPoll) { window.clearInterval(this.spotifyPoll); this.spotifyPoll = null; }
    if (this.mode === "spotify") void this.spotify.pause();
    this.spotifyUri = null;
  }

  private async start(it: PlayItem): Promise<void> {
    const engine = this.engineFor(it);
    if (!engine) return;
    this.teardownEngines();
    this.mode = engine; this.paused = false;
    document.body.addClass("sg-player-on");
    if (engine === "audio") this.startAudio(it.url!);
    else if (engine === "youtube") this.startYouTube(it.yt!);
    else await this.startSpotify(it);
    this.emit();
  }

  // ------------------------------------------------------------- audio
  private startAudio(url: string): void {
    const a = new Audio(url);
    this.audio = a;
    a.onended = () => { if (this.audio === a) this.step(1); };
    a.onerror = () => { if (this.audio === a) { new Notice("That recording would not play."); this.step(1); } };
    a.ontimeupdate = () => { if (this.audio === a && this.progress && a.duration) this.progress.style.width = `${(a.currentTime / a.duration) * 100}%`; };
    void a.play().catch(() => new Notice("Tap again to start playback."));
  }

  // ----------------------------------------------------------- youtube
  /** YouTube's player, driven over its postMessage protocol (no script
   * to load), visible above the bar as its terms require */
  private startYouTube(id: string): void {
    if (!this.video) return;
    this.video.empty(); this.video.show();
    const f = this.video.createEl("iframe", { cls: "sg-player-frame" });
    f.setAttr("allow", "autoplay; encrypted-media; picture-in-picture");
    f.setAttr("allowfullscreen", "true");
    f.setAttr("frameborder", "0");
    f.src = `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    f.onload = () => { f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "sg", channel: "widget" }), "*"); };
    this.frame = f;
  }
  private frameCmd(func: string): void {
    this.frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  }
  private onFrameMessage = (ev: MessageEvent) => {
    if (this.mode !== "youtube" || !this.frame || ev.source !== this.frame.contentWindow) return;
    let d: { event?: string; info?: { playerState?: number; currentTime?: number; duration?: number } };
    try { d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
    if (d.event !== "infoDelivery" || !d.info) return;
    if (d.info.playerState === 0) this.step(1);                       // ended
    if (d.info.playerState === 1 && this.paused) { this.paused = false; this.emit(); }
    if (d.info.playerState === 2 && !this.paused) { this.paused = true; this.emit(); }
    if (this.progress && d.info.duration && d.info.currentTime !== undefined) {
      this.progress.style.width = `${(d.info.currentTime / d.info.duration) * 100}%`;
    }
  };

  // ----------------------------------------------------------- spotify
  private async startSpotify(it: PlayItem): Promise<void> {
    const uri = await this.spotify.find(it.searchQuery);
    if (!uri) { new Notice(`Spotify has no match for "${it.title}".`); this.step(1); return; }
    const ok = await this.spotify.play(uri);
    if (!ok) { this.mode = null; document.body.removeClass("sg-player-on"); this.emit(); return; }
    this.spotifyUri = uri; this.spotifySeen = false;
    this.spotifyPoll = window.setInterval(() => void this.pollSpotify(), 4000);
  }
  private async pollSpotify(): Promise<void> {
    if (this.mode !== "spotify") return;
    const st = await this.spotify.state();
    if (!st) return;
    if (st.uri === this.spotifyUri && st.playing) this.spotifySeen = true;
    if (this.progress && st.duration) this.progress.style.width = `${(st.progress / st.duration) * 100}%`;
    // it played, and now it is over (stopped, or Spotify moved on by itself)
    if (this.spotifySeen && (!st.playing && st.progress === 0 || (st.uri !== this.spotifyUri && st.playing))) {
      if (st.uri !== this.spotifyUri && st.playing) { /* Spotify autoplayed something: take the queue back */ }
      this.step(1);
    }
  }

  // ------------------------------------------------------- elsewhere
  async service(): Promise<Service | null> {
    const s = this.prefs.get();
    if (s) return s;
    return new Promise(resolve => {
      const m = new Modal(this.app);
      let done = false;
      m.contentEl.addClass("sg-welcome");
      m.contentEl.createEl("h3", { text: "Where do you listen?" });
      m.contentEl.createEl("p", { text: "Songs that can't play here open in your own music app. Change it any time from a song's ⋯ menu." });
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
    const eng = this.engineFor(it);
    if (eng) m.addItem(i => i.setTitle(eng === "audio" ? "Play here" : eng === "spotify" ? "Play on Spotify" : "Play here (YouTube)").setIcon("play").onClick(() => this.play([it], 0)));
    if (it.yt && eng !== "youtube") m.addItem(i => i.setTitle("Play here (YouTube)").setIcon("play").onClick(() => { this.queue = [it]; this.index = 0; this.teardownEngines(); this.mode = "youtube"; this.paused = false; document.body.addClass("sg-player-on"); this.startYouTube(it.yt!); this.emit(); }));
    for (const a of it.alt ?? []) m.addItem(i => i.setTitle(a.label).setIcon("music").onClick(() => this.playUrl(it, a.url)));
    m.addSeparator();
    for (const sv of SERVICES) m.addItem(i => i.setTitle(`Open in ${sv.label}`).setIcon("external-link").onClick(() => void this.openElsewhere(it, sv.key)));
    if (it.wordsUrl) m.addItem(i => i.setTitle("Words & sheet music").setIcon("file-text").onClick(() => window.open(it.wordsUrl!, "_blank")));
    if (it.credit) m.addItem(i => i.setTitle(`Recording: ${it.credit}`).setIcon("info"));
    m.addSeparator();
    if (this.spotify.configured && !this.spotify.connected) m.addItem(i => i.setTitle("Connect Spotify (plays in the background)").setIcon("log-in").onClick(() => void this.spotify.beginConnect()));
    m.addItem(i => i.setTitle("Change my music app…").setIcon("settings").onClick(async () => { await this.prefs.set(null); await this.service(); }));
    m.showAtMouseEvent(ev);
  }

  // ------------------------------------------------------------- the bar
  mount(): void {
    if (this.bar) return;
    const wrap = document.body.createDiv({ cls: "sg-player-wrap" });
    this.video = wrap.createDiv({ cls: "sg-player-video" });
    this.video.hide();
    this.bar = wrap.createDiv({ cls: "sg-player" });
    this.paint();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("message", this.onFrameMessage);
    this.bar?.parentElement?.remove(); this.bar = null; this.video = null;
  }

  private paint(): void {
    const bar = this.bar;
    if (!bar) return;
    bar.empty();
    const it = this.current();
    if (!it || !this.mode) { bar.parentElement?.hide(); return; }
    bar.parentElement?.show();
    const line = bar.createDiv({ cls: "sg-player-line" });
    this.progress = line.createDiv({ cls: "sg-player-prog" });
    if (it.art && this.mode !== "youtube") { const img = bar.createEl("img", { cls: "sg-player-art" }); img.src = it.art; }
    const meta = bar.createDiv({ cls: "sg-player-meta" });
    meta.createDiv({ cls: "sg-player-title", text: it.title });
    meta.createDiv({ cls: "sg-player-sub", text: this.mode === "spotify" ? "Playing on Spotify" : this.mode === "youtube" ? "YouTube" : it.sub });
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
