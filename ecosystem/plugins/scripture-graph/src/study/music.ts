/** The music player — one queue, one mini bar above the dock, the way a
 * streaming app does it. Three engines behind one set of controls:
 *
 *   audio    — a stream from the Church's servers (the Tabernacle Choir's
 *              conference performances, the hymnbook recordings) or a
 *              public-domain performance, played by the app itself
 *   spotify  — the listener's Spotify app plays in the background, we drive it
 *
 * Headless, always. Nothing ever leaves the app. */
import { App, Menu, Notice } from "obsidian";
import type { Spotify } from "./spotify";

export type Service = "spotify" | "apple" | "youtube";

export interface PlayItem {
  id: string;
  title: string;
  /** "Hymn 85 · Church recording" */
  sub: string;
  /** a free stream; absent = another engine or elsewhere */
  url?: string;
  alt?: { label: string; url: string }[];
  searchQuery: string;
  wordsUrl?: string;
  credit?: string;
  art?: string;
  open?: () => void;
}

type Mode = "audio" | "spotify";

export class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private mode: Mode | null = null;
  queue: PlayItem[] = [];
  index = -1;
  paused = false;
  private bar: HTMLElement | null = null;
  private progress: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private spotifyPoll: number | null = null;
  private spotifyUri: string | null = null;
  private spotifySeen = false;

  constructor(private app: App, private prefs: { get(): Service | null; set(s: Service | null): Promise<void> },
    public spotify: Spotify) {
  }

  on(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } this.paint(); }

  current(): PlayItem | null { return this.queue[this.index] ?? null; }
  isCurrent(id: string): boolean { return this.current()?.id === id; }
  get playing(): boolean { return this.mode !== null && !this.paused; }
  get active(): boolean { return this.mode !== null; }

  /** how this item would play, if tapped */
  engineFor(it: PlayItem): Mode | null {
    if (it.url) return "audio";                     // the Church's servers: Choir, hymns, free recordings
    if (this.spotify.connected) return "spotify";   // headless too, for what the Church does not host
    return null;
  }
  canPlay(it: PlayItem): boolean { return this.engineFor(it) !== null; }

  /** tap on a row */
  play(queue: PlayItem[], index: number): void {
    const it = queue[index];
    if (!it) return;
    if (!this.canPlay(it)) { new Notice("The Church doesn't host a recording of this one — connect Spotify in Settings → Music to play it."); return; }
    this.queue = queue;
    this.index = index;
    void this.start(it);
  }

  /** the big Play button: everything in the list that plays here, in order */
  playAll(queue: PlayItem[], shuffle = false): void {
    let q = queue.filter(i => this.canPlay(i));
    if (!q.length) { new Notice("Nothing in this list has a Church recording — connect Spotify to play it."); return; }
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

  /** the ⋯ on a row */
  menu(it: PlayItem, ev: MouseEvent): void {
    const m = new Menu();
    const eng = this.engineFor(it);
    if (eng) m.addItem(i => i.setTitle(eng === "audio" ? "Play here" : "Play on Spotify").setIcon("play").onClick(() => this.play([it], 0)));
    if (it.url && eng !== "audio") m.addItem(i => i.setTitle("Play the plain recording").setIcon("music").onClick(() => this.playUrl(it, it.url!)));
    for (const a of it.alt ?? []) m.addItem(i => i.setTitle(a.label).setIcon("music").onClick(() => this.playUrl(it, a.url)));
    if (!eng) m.addItem(i => i.setTitle("Plays through Spotify once connected").setIcon("clock").setDisabled(true));
    if (it.wordsUrl || it.credit) m.addSeparator();
    if (it.wordsUrl) m.addItem(i => i.setTitle("Words & sheet music (Church site)").setIcon("file-text").onClick(() => window.open(it.wordsUrl!, "_blank")));
    if (it.credit) m.addItem(i => i.setTitle(`Recording: ${it.credit}`).setIcon("info").setDisabled(true));
    if (this.spotify.configured && !this.spotify.connected) {
      m.addSeparator();
      m.addItem(i => i.setTitle("Connect Spotify (plays in the background)").setIcon("log-in").onClick(() => void this.spotify.beginConnect()));
    }
    m.showAtMouseEvent(ev);
  }

  // ------------------------------------------------------------- the bar
  mount(): void {
    if (this.bar) return;
    const wrap = document.body.createDiv({ cls: "sg-player-wrap" });
    this.bar = wrap.createDiv({ cls: "sg-player" });
    this.paint();
  }

  destroy(): void {
    this.stop();
    this.bar?.parentElement?.remove(); this.bar = null;
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
    if (it.art) { const img = bar.createEl("img", { cls: "sg-player-art" }); img.src = it.art; }
    const meta = bar.createDiv({ cls: "sg-player-meta" });
    meta.createDiv({ cls: "sg-player-title", text: it.title });
    meta.createDiv({ cls: "sg-player-sub", text: this.mode === "spotify" ? "Playing on Spotify" : it.sub });
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
