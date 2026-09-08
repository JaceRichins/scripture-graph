/** ＋ a song on a playlist, from a pasted YouTube link.
 *
 * The engine writes the playlists; the family adds to them. An added song
 * is an annotation on the playlist itself (anchor "playlist:<key>"), so it
 * syncs like a note, shows on every phone in the family, and can be taken
 * off again by whoever added it. The title and artist come from YouTube's
 * own oEmbed answer for the link, editable before saving. */
import { Modal, Notice, requestUrl } from "obsidian";
import type { SGState } from "../state";
import type { AnnotationService } from "../social/annotations";
import { trace } from "./trace";

export interface AddedSong { t: string; a: string; yt: string }
export interface PlaylistSong extends AddedSong { id: string; mine: boolean }

const SONG_RE = /^Song:\s*(\{[\s\S]*\})\s*$/;

export function playlistAnchor(key: string): string { return `playlist:${key}`; }

export function youtubeIdFromUrl(text: string): string | null {
  const t = text.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|music\.youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/.exec(t);
  return m ? m[1]! : null;
}

/** the songs the family has added to a playlist: mine, then the others' shared ones */
export async function songsOn(ann: AnnotationService, key: string): Promise<PlaylistSong[]> {
  const anchor = playlistAnchor(key);
  await ann.refreshSocial([anchor]);
  const parse = (id: string, content: string, mine: boolean): PlaylistSong | null => {
    const m = SONG_RE.exec(content);
    if (!m) return null;
    try {
      const s = JSON.parse(m[1]!) as Partial<AddedSong>;
      if (!s.yt || !s.t) return null;
      return { id, t: s.t, a: s.a || "YouTube", yt: s.yt, mine };
    } catch { return null; }
  };
  const out: PlaylistSong[] = [];
  const mine = (await ann.mine(anchor)).filter(a => !a.deleted_at && a.annotation_type === "note");
  for (const a of mine) { const s = parse(a.annotation_id, a.content, true); if (s) out.push(s); }
  for (const a of ann.social(anchor)) {
    if (a.deleted_at || a.annotation_type !== "note") continue;
    const s = parse(a.annotation_id, a.content, false);
    if (s && !out.some(x => x.yt === s.yt)) out.push(s);
  }
  return out;
}

/** YouTube's own title and channel for a video (no key needed) */
async function lookup(id: string): Promise<{ title: string; author: string } | null> {
  try {
    const res = await requestUrl({ url: `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, throw: false });
    if (res.status !== 200) return null;
    const j = res.json as { title?: string; author_name?: string };
    return j.title ? { title: j.title, author: j.author_name ?? "" } : null;
  } catch { return null; }
}

export class AddSongModal extends Modal {
  private id: string | null = null;
  constructor(private s: SGState, private ann: AnnotationService, private key: string, private playlistTitle: string,
    private onAdded: () => void) {
    super(s.app);
  }

  onOpen(): void {
    const c = this.contentEl;
    c.addClass("sg-addsong");
    c.createDiv({ cls: "sg-connect-eyebrow", text: "Add a song" });
    c.createEl("h3", { cls: "sg-addsong-title", text: this.playlistTitle });
    c.createDiv({ cls: "sg-connect-hint", text: "Paste a YouTube link. The title fills in by itself." });
    const link = c.createEl("input", { cls: "sg-nav-filter sg-addsong-link", attr: { type: "url", placeholder: "https://youtu.be/…", autocapitalize: "off", autocorrect: "off" } });
    const found = c.createDiv({ cls: "sg-addsong-found" });
    const title = c.createEl("input", { cls: "sg-nav-filter", attr: { type: "text", placeholder: "Title" } });
    const artist = c.createEl("input", { cls: "sg-nav-filter", attr: { type: "text", placeholder: "Who sings it" } });
    const actions = c.createDiv({ cls: "sg-connect-actions" });
    const add = actions.createEl("button", { cls: "mod-cta", text: "＋ Add to playlist" });
    add.setAttribute("disabled", "true");

    let seq = 0;
    const onLink = () => {
      const id = youtubeIdFromUrl(link.value);
      this.id = id;
      found.empty();
      add.toggleAttribute("disabled", !id);
      if (!id) { if (link.value.trim()) found.setText("That doesn't look like a YouTube link."); return; }
      const img = found.createEl("img", { cls: "sg-addsong-thumb" });
      img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
      const my = ++seq;
      found.createSpan({ cls: "sg-addsong-status", text: "Looking it up…" });
      void lookup(id).then(meta => {
        if (my !== seq) return;
        found.querySelector(".sg-addsong-status")?.remove();
        if (!meta) { found.createSpan({ cls: "sg-addsong-status", text: "Couldn't fetch the title — type it in." }); title.focus(); return; }
        if (!title.value.trim()) title.value = meta.title;
        if (!artist.value.trim()) artist.value = meta.author.replace(/\s*-\s*Topic$/i, "");
        found.createSpan({ cls: "sg-addsong-status", text: meta.title });
      });
    };
    link.oninput = onLink;
    link.onpaste = () => window.setTimeout(onLink, 0);
    add.onclick = () => void this.save(title.value.trim(), artist.value.trim(), add);
    // whatever is on the clipboard already, when it is a link
    void navigator.clipboard?.readText?.().then(t => { if (t && youtubeIdFromUrl(t) && !link.value) { link.value = t.trim(); onLink(); } }).catch(() => { /* no clipboard access */ });
    window.setTimeout(() => link.focus(), 60);
  }

  private async save(t: string, a: string, btn: HTMLButtonElement): Promise<void> {
    if (!this.id) return;
    const song: AddedSong = { t: t || "Untitled", a: a || "YouTube", yt: this.id };
    btn.setAttribute("disabled", "true"); btn.setText("Adding…");
    // the family's playlist: everyone signed in sees the song
    await this.ann.addNote(playlistAnchor(this.key), `Song: ${JSON.stringify(song)}`, null, "public", null);
    trace("song.add", { key: this.key, yt: this.id });
    new Notice(`Added “${song.t}” to ${this.playlistTitle}`);
    this.close();
    this.onAdded();
  }

  onClose(): void { this.contentEl.empty(); }
}
