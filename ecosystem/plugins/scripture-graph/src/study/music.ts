/** The media player — one queue, one mini bar above the dock, the way a
 * streaming app does it. Three engines behind one set of controls:
 *
 *   audio    — a stream from the Church's servers (the Tabernacle Choir's
 *              conference performances, the hymnbook recordings) or a
 *              public-domain performance; headless, keeps playing with the
 *              screen off
 *   spotify  — the listener's Spotify app plays in the background, we drive it
 *   youtube  — YouTube's own player in a small window in the corner, served
 *              through the family server so YouTube accepts it. Music,
 *              conference talks, podcasts, reviews: anything on YouTube
 *              plays here and keeps playing while you move around the app.
 *
 * Nothing ever leaves the app. */
import { App, Menu, Notice, requestUrl, setIcon } from "obsidian";
import type { Spotify } from "./spotify";

export type Service = "spotify" | "apple" | "youtube";

export interface PlayItem {
  id: string;
  title: string;
  /** "Hymn 85 · Church recording" */
  sub: string;
  /** a stream the app plays itself */
  url?: string;
  /** a YouTube video id */
  yt?: string;
  /** playlists: a performance elsewhere beats the plain hymnbook recording */
  preferVideo?: boolean;
  /** the picture matters (a talk, an episode): the visible player, not the sound alone */
  video?: boolean;
  alt?: { label: string; url: string }[];
  searchQuery: string;
  wordsUrl?: string;
  credit?: string;
  art?: string;
  open?: () => void;
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
  private tab: HTMLElement | null = null;
  private tucked = false;
  private frameReady = false;
  private progress: HTMLElement | null = null;
  private listeners = new Set<() => void>();
  private spotifyPoll: number | null = null;
  private spotifyUri: string | null = null;
  private spotifySeen = false;

  constructor(private app: App,
    private opts: { serverUrl(): string; youtubeEnabled(): boolean; onChange?(): void },
    public spotify: Spotify) {
    window.addEventListener("message", this.onFrameMessage);
  }

  on(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const f of this.listeners) { try { f(); } catch { /* ui */ } } this.paint(); }

  current(): PlayItem | null { return this.queue[this.index] ?? null; }
  isCurrent(id: string): boolean { return this.current()?.id === id; }
  /** the video window's state, for the dock's headphones: playing, paused, or no video */
  get videoState(): "playing" | "paused" | null {
    if (this.mode !== "youtube" || !this.current()) return null;
    return this.paused ? "paused" : "playing";
  }
  get playing(): boolean { return this.mode !== null && !this.paused; }
  get active(): boolean { return this.mode !== null; }

  /** how this item would play, if tapped */
  engineFor(it: PlayItem): Mode | null {
    // playlists and talks ask for YouTube first (the better sound); the
    // hymnbook shelf plays the Church's own recordings headless
    if (it.preferVideo && it.yt && this.opts.youtubeEnabled()) {
      // music: YouTube's sound as a plain stream through the family server —
      // headless, keeps playing with the screen off; the picture only when asked
      return it.video || !this.opts.serverUrl() ? "youtube" : "audio";
    }
    if (it.url) return "audio";
    if (this.spotify.connected) return "spotify";
    if (it.yt && this.opts.youtubeEnabled()) return "youtube";
    return null;
  }
  canPlay(it: PlayItem): boolean { return this.engineFor(it) !== null; }
  /** plays without showing anything */
  headless(it: PlayItem): boolean { const e = this.engineFor(it); return e === "audio" || e === "spotify"; }

  /** tap on a row */
  play(queue: PlayItem[], index: number): void {
    const it = queue[index];
    if (!it) return;
    if (!this.canPlay(it)) { new Notice("No recording for this one yet — connect Spotify in Settings → Music, or wait for its video."); return; }
    this.queue = queue;
    this.index = index;
    void this.start(it);
  }

  /** a single video (a talk, a podcast episode, a review) */
  playVideo(id: string, title: string, sub: string, open?: () => void, video = true): void {
    this.play([{ id: `yt:${id}`, title, sub, yt: id, preferVideo: true, video, searchQuery: title, open }], 0);
  }

  /** where an item's plain audio comes from: its own stream, or YouTube's sound via the server */
  private audioSrc(it: PlayItem): { src: string; fromYouTube: boolean } | null {
    if (it.preferVideo && it.yt && !it.video && this.opts.serverUrl() && this.opts.youtubeEnabled()) {
      return { src: `${this.opts.serverUrl().replace(/\/$/, "")}/yt/audio?v=${encodeURIComponent(it.yt)}`, fromYouTube: true };
    }
    return it.url ? { src: it.url, fromYouTube: false } : null;
  }

  /** the big Play button: everything in the list that plays here, in order */
  playAll(queue: PlayItem[], shuffle = false): void {
    let q = queue.filter(i => this.canPlay(i));
    if (!q.length) { new Notice("Nothing in this list can play yet."); return; }
    if (shuffle) q = q.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    this.queue = q; this.index = 0;
    void this.start(q[0]!);
  }

  /** a specific stream of the item (accompaniment, the plain recording) */
  playUrl(it: PlayItem, url: string): void {
    if (!this.isCurrent(it.id)) { this.queue = [it]; this.index = 0; }
    void this.start({ ...it, url, preferVideo: false, yt: undefined });
  }

  toggle(): void {
    if (!this.mode) return;
    const resume = this.paused;
    this.paused = !this.paused;
    if (this.mode === "audio" && this.audio) { if (resume) void this.audio.play(); else this.audio.pause(); }
    else if (this.mode === "youtube") this.frameCmd(resume ? "play" : "pause");
    else if (this.mode === "spotify") { if (resume) void this.spotify.resume(); else void this.spotify.pause(); }
    try { (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession!.playbackState = resume ? "playing" : "paused"; } catch { /* none */ }
    this.emit();
  }

  next(): void { this.step(1); }
  prev(): void {
    if (this.mode === "audio" && this.audio && this.audio.currentTime > 4) { this.audio.currentTime = 0; return; }
    if (this.mode === "youtube") { this.frameCmd("seek", { t: 0 }); return; }
    this.step(-1);
  }

  private step(d: number): void {
    let i = this.index + d;
    // moving through a queue stays headless unless the current song is itself a video
    const allow = (x: PlayItem) => this.canPlay(x);
    while (this.queue[i] && !allow(this.queue[i]!)) i += d;
    if (!this.queue[i]) { this.stop(); return; }
    this.index = i;
    void this.start(this.queue[i]!);
  }

  stop(): void {
    this.teardownEngines(true);
    if (this.audio) { this.audio.removeAttribute("src"); this.audio.load(); }
    this.queue = []; this.index = -1; this.paused = false; this.mode = null;
    document.body.removeClass("sg-player-on");
    this.emit();
  }

  private teardownEngines(all = false): void {
    this.audio?.pause();
    this.audioFallback = null;
    if (all && this.frame) { this.frame.remove(); this.frame = null; this.frameReady = false; }
    if (all) this.video?.hide();
    if (this.spotifyPoll) { window.clearInterval(this.spotifyPoll); this.spotifyPoll = null; }
    if (this.mode === "spotify") void this.spotify.pause();
    this.spotifyUri = null;
  }

  private async start(it: PlayItem): Promise<void> {
    const engine = this.engineFor(it);
    if (!engine) return;
    this.teardownEngines(engine !== "youtube");
    this.mode = engine; this.paused = false;
    document.body.addClass("sg-player-on");
    if (engine === "audio") {
      const a = this.audioSrc(it);
      if (!a) return;
      // the server can't give the sound (offline, or YouTube changed): the picture instead
      this.startAudio(a.src, a.fromYouTube && it.yt ? () => { this.mode = "youtube"; this.startYouTube(it.yt!); this.emit(); } : undefined);
    }
    else if (engine === "youtube") this.startYouTube(it.yt!);
    else await this.startSpotify(it);
    this.mediaSession(it);
    this.prewarm();
    this.emit();
  }

  /** the lock screen and earbuds: what's playing, and play/pause/next/prev */
  private mediaSession(it: PlayItem): void {
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms) return;
    try {
      const art = it.art ?? (it.yt ? `https://i.ytimg.com/vi/${it.yt}/mqdefault.jpg` : undefined);
      ms.metadata = new MediaMetadata({ title: it.title, artist: it.sub, album: "Scripture Graph",
        artwork: art ? [{ src: art, sizes: "320x180", type: "image/jpeg" }] : [] });
      ms.setActionHandler("play", () => { if (this.paused) this.toggle(); });
      ms.setActionHandler("pause", () => { if (!this.paused) this.toggle(); });
      ms.setActionHandler("previoustrack", () => this.prev());
      ms.setActionHandler("nexttrack", () => this.next());
      ms.playbackState = "playing";
    } catch { /* no media session here */ }
  }

  // ------------------------------------------------------------- audio
  private audioFallback: (() => void) | null = null;

  /** ONE audio element for the whole session. iOS lets an element that is
   * already playing carry on with the screen off, and lets it move to the
   * next song from its own `ended` event; a fresh element per song needs a
   * finger on the screen, which is the silence after the first track. */
  private audioEl(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = "auto";
    a.setAttribute("playsinline", "true");
    a.onended = () => { if (this.mode === "audio" && this.audio === a) this.step(1); };
    a.onerror = () => {
      if (this.mode !== "audio" || this.audio !== a || !a.getAttribute("src")) return;
      const fb = this.audioFallback; this.audioFallback = null;
      if (fb) { fb(); return; }
      new Notice("That recording would not play."); this.step(1);
    };
    a.ontimeupdate = () => { if (this.audio === a && this.progress && a.duration) this.progress.style.width = `${(a.currentTime / a.duration) * 100}%`; };
    this.audio = a;
    return a;
  }

  private startAudio(url: string, fallback?: () => void): void {
    const a = this.audioEl();
    this.audioFallback = fallback ?? null;
    if (this.progress) this.progress.style.width = "0%";
    a.src = url;
    a.load();
    void a.play().catch(() => new Notice("Tap again to start playback."));
  }

  /** the song after this one: have the server find its stream now, so the
   * end of this song hands over without a wait */
  private prewarm(): void {
    const next = this.queue[this.index + 1];
    if (!next?.yt || !next.preferVideo || next.video || !this.opts.serverUrl() || !this.opts.youtubeEnabled()) return;
    const base = this.opts.serverUrl().replace(/\/$/, "");
    void requestUrl({ url: `${base}/yt/audio/ready?v=${encodeURIComponent(next.yt)}`, throw: false }).catch(() => { /* later, then */ });
  }

  // ----------------------------------------------------------- youtube
  /** the player page on the family server hosts YouTube's player; we talk to
   * it over postMessage and it relays state and progress back */
  private startYouTube(id: string): void {
    if (!this.video) return;
    this.video.show();
    if (this.frame && this.frameReady) { this.frameCmd("load", { id }); return; }
    if (this.frame) { this.frame.remove(); this.frame = null; }
    const base = this.opts.serverUrl().replace(/\/$/, "");
    const f = this.video.createEl("iframe", { cls: "sg-player-frame" });
    f.setAttr("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    f.setAttr("allowfullscreen", "true");
    f.setAttr("frameborder", "0");
    f.src = `${base}/yt?v=${encodeURIComponent(id)}`;
    this.frame = f; this.frameReady = false;
  }
  private frameCmd(func: string, extra: Record<string, unknown> = {}): void {
    this.frame?.contentWindow?.postMessage({ sg: "cmd", func, ...extra }, "*");
  }
  private onFrameMessage = (ev: MessageEvent) => {
    if (!this.frame || ev.source !== this.frame.contentWindow) return;
    const m = ev.data as { sg?: string; type?: string; state?: number; t?: number; d?: number; code?: number };
    if (!m || m.sg !== "yt") return;
    if (m.type === "ready") { this.frameReady = true; return; }
    if (this.mode !== "youtube") return;
    if (m.type === "error") { new Notice(`YouTube couldn't play that one (error ${m.code}).`); this.step(1); return; }
    if (m.type === "state") {
      if (m.state === 0) this.step(1);                                   // ended
      else if (m.state === 1 && this.paused) { this.paused = false; this.emit(); }
      else if (m.state === 2 && !this.paused) { this.paused = true; this.emit(); }
    }
    if (m.type === "time" && this.progress && m.d) this.progress.style.width = `${((m.t ?? 0) / m.d) * 100}%`;
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
    if (this.spotifySeen && ((!st.playing && st.progress === 0) || (st.uri !== this.spotifyUri && st.playing))) this.step(1);
  }

  /** the ⋯ on a row */
  menu(it: PlayItem, ev: MouseEvent): void {
    const m = new Menu();
    const eng = this.engineFor(it);
    if (eng) m.addItem(i => i.setTitle(eng === "audio" ? "Play here" : eng === "spotify" ? "Play on Spotify" : "Play (YouTube)").setIcon("play").onClick(() => this.play([it], 0)));
    if (it.yt && eng !== "youtube" && this.opts.youtubeEnabled()) m.addItem(i => i.setTitle("Play the YouTube version").setIcon("play").onClick(() => this.play([{ ...it, url: undefined, preferVideo: true }], 0)));
    if (it.url && eng !== "audio") m.addItem(i => i.setTitle(it.credit ? "Play the recording here" : "Play the plain recording").setIcon("music").onClick(() => this.playUrl(it, it.url!)));
    for (const a of it.alt ?? []) m.addItem(i => i.setTitle(a.label).setIcon("music").onClick(() => this.playUrl(it, a.url)));
    if (!eng) m.addItem(i => i.setTitle("Nothing to play yet").setIcon("clock").setDisabled(true));
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
    this.video = wrap.createDiv({ cls: "sg-player-video" });
    this.video.hide();
    this.bar = wrap.createDiv({ cls: "sg-player" });
    this.makeDraggable(this.video);
    // the edge tab: what's left of the video once it slides off the right
    // side of the screen; tap it to slide the video back
    this.tab = wrap.createEl("button", { cls: "sg-player-tab", text: "‹", attr: { "aria-label": "Show video" } });
    this.tab.onclick = (e) => { e.stopPropagation(); this.setTucked(false); };
    if (window.localStorage.getItem("sg-video-tucked") === "1") this.setTucked(true, true);
    this.paint();
  }

  /** the video window goes wherever the finger puts it (a drag handle rides
   * its top edge so YouTube's own controls keep their taps), and remembers */
  private makeDraggable(win: HTMLElement): void {
    const handle = win.createDiv({ cls: "sg-player-grip", text: "⋮⋮ drag" });
    let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    const saved = window.localStorage.getItem("sg-video-pos");
    if (saved) { try { const p = JSON.parse(saved) as { x: number; y: number }; this.placeVideo(win, p.x, p.y); } catch { /* fresh */ } }
    handle.onpointerdown = (e) => {
      e.preventDefault(); e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const r = win.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moved = false;
      win.addClass("sg-player-free");
    };
    handle.onpointermove = (e) => {
      if (!handle.hasPointerCapture(e.pointerId)) return;
      const x = ox + (e.clientX - sx), y = oy + (e.clientY - sy);
      if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) moved = true;
      this.placeVideo(win, x, y);
    };
    handle.onpointerup = (e) => {
      handle.releasePointerCapture(e.pointerId);
      if (!moved) return;
      const r = win.getBoundingClientRect();
      window.localStorage.setItem("sg-video-pos", JSON.stringify({ x: r.left, y: r.top }));
    };
  }

  private placeVideo(win: HTMLElement, x: number, y: number): void {
    const w = win.offsetWidth || 200, h = win.offsetHeight || 200;
    x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
    win.addClass("sg-player-free");
    win.style.left = `${x}px`; win.style.top = `${y}px`;
  }

  /** › on the bar: slide the video off the right edge of the screen, leaving
   * a chevron tab (the sound keeps playing); ‹ on the tab brings it back */
  private tuckVideo(): void { this.setTucked(!this.tucked); }

  private setTucked(on: boolean, silent = false): void {
    const win = this.video;
    if (!win) return;
    this.tucked = on;
    win.toggleClass("sg-player-tucked", on);
    this.tab?.toggleClass("sg-player-tab-on", on && this.mode === "youtube");
    if (on) window.localStorage.setItem("sg-video-tucked", "1");
    else window.localStorage.removeItem("sg-video-tucked");
    if (!silent) this.paint();
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("message", this.onFrameMessage);
    this.bar?.parentElement?.remove(); this.bar = null; this.video = null; this.tab = null;
  }

  private paint(): void {
    const bar = this.bar;
    if (!bar) return;
    bar.empty();
    const it = this.current();
    if (!it || !this.mode) { bar.parentElement?.hide(); this.opts.onChange?.(); return; }
    bar.parentElement?.show();
    const yt = this.mode === "youtube";
    if (!yt) this.video?.hide();
    this.tab?.toggleClass("sg-player-tab-on", this.tucked && yt);
    const line = bar.createDiv({ cls: "sg-player-line" });
    this.progress = line.createDiv({ cls: "sg-player-prog" });

    // art: the cover, or the video's thumbnail; for YouTube it doubles as
    // the show/hide-video switch, with a chevron badge saying which way
    const artUrl = it.art ?? (it.yt ? `https://i.ytimg.com/vi/${it.yt}/mqdefault.jpg` : undefined);
    const art = bar.createDiv({ cls: "sg-player-art" });
    if (artUrl) { const img = art.createEl("img"); img.src = artUrl; img.alt = ""; }
    else setIcon(art.createDiv({ cls: "sg-player-art-icon" }), "music");
    if (yt) {
      art.addClass("sg-player-art-toggle");
      art.setAttr("aria-label", this.tucked ? "Show video" : "Hide video");
      setIcon(art.createDiv({ cls: "sg-player-art-badge" }), this.tucked ? "chevron-left" : "chevron-right");
      art.onclick = (e) => { e.stopPropagation(); this.tuckVideo(); };
    }

    const meta = bar.createDiv({ cls: "sg-player-meta" });
    meta.createDiv({ cls: "sg-player-title", text: it.title });
    meta.createDiv({ cls: "sg-player-sub", text: this.mode === "spotify" ? "Playing on Spotify" : yt ? (this.tucked ? "Tap the picture to show the video" : "Tap to enlarge the video") : it.sub });
    if (yt) meta.onclick = () => { if (this.tucked) this.setTucked(false); else bar.parentElement?.toggleClass("sg-player-big", !bar.parentElement.hasClass("sg-player-big")); };
    else if (it.open) meta.onclick = it.open;

    const btn = (icon: string, cls: string, label: string, fn: () => void) => {
      const b = bar.createEl("button", { cls: `sg-player-btn ${cls}`, attr: { "aria-label": label } });
      setIcon(b, icon);
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      return b;
    };
    const ctl = bar.createDiv({ cls: "sg-player-ctl" });
    const inCtl = (icon: string, cls: string, label: string, fn: () => void) => { const b = btn(icon, cls, label, fn); ctl.appendChild(b); return b; };
    inCtl("skip-back", "", "Previous", () => this.prev());
    inCtl(this.paused ? "play" : "pause", "sg-player-main", this.paused ? "Play" : "Pause", () => this.toggle());
    inCtl("skip-forward", "", "Next", () => this.next());
    btn("x", "sg-player-x", "Stop", () => this.stop());
    this.opts.onChange?.();
  }
}
