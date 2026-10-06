import { Notice, type App, type TFile } from 'obsidian';
import type { MusicPlayer, PlayItem } from './music';

export const NARRATION_INDEX = 'AI Library/12 Family/Family Narration.md';
const AUDIO = 'AI Library/12 Family/_media/stories/';

export function familyStoryId(app: App, file: TFile | null): string | null {
  if (!file?.path.startsWith('AI Library/12 Family/Stories/')) return null;
  const id = app.metadataCache.getFileCache(file)?.frontmatter?.['sg-id'];
  const match = /^story:([a-f0-9]{12})$/.exec(String(id ?? ''))
    ?? /\(([a-f0-9]{12})\)\.md$/.exec(file.path);
  return match?.[1] ?? null;
}

export function narrationTracks(raw: string, id: string): { path: string; seconds: number }[] {
  const json = /```json\s*([\s\S]*?)```/.exec(raw);
  if (!json) return [];
  const data = JSON.parse(json[1]!);
  const tracks = data.schema === 1 ? data.stories?.[id]?.tracks : null;
  if (!Array.isArray(tracks) || !tracks.length) return [];
  // The index is a list of recordings, never an arbitrary file/URL authority.
  const valid = tracks.every(t => typeof t.path === 'string' && t.path.startsWith(AUDIO)
    && new RegExp(`^${id}-full-[a-f0-9]{12}-[1-9][0-9]*\\.mp3$`).test(t.path.slice(AUDIO.length))
    && typeof t.seconds === 'number' && Number.isFinite(t.seconds) && t.seconds > 0);
  if (!valid) throw Error('Invalid family narration index');
  return tracks;
}

export class FamilyNarrator {
  private loading = false;
  constructor(private app: App, private music: MusicPlayer, private io: {
    ensure(path: string): Promise<boolean>;
    refreshIndex(): Promise<void>;
    resource(path: string): string | null;
  }) {}

  state(file: TFile | null): 'playing' | 'paused' | null {
    const id = familyStoryId(this.app, file);
    if (!id || !this.music.current()?.id.startsWith(`family:${id}:`)) return null;
    return this.music.playing ? 'playing' : 'paused';
  }

  async toggle(file: TFile): Promise<void> {
    const id = familyStoryId(this.app, file);
    if (!id || this.loading) return;
    if (this.state(file)) { this.music.toggle(); return; }
    this.music.prepareAudioGesture();
    this.loading = true;
    const notice = new Notice('Loading the saved narration…', 0);
    try {
      await this.io.ensure(NARRATION_INDEX);
      const read = async () => {
        try { return narrationTracks(await this.app.vault.adapter.read(NARRATION_INDEX), id); }
        catch { return []; }
      };
      let tracks = await read();
      if (!tracks.length) { await this.io.refreshIndex(); tracks = await read(); }
      if (!tracks.length) {
        new Notice('This story is still waiting for its saved narration. Try again after the laptop finishes it.');
        return;
      }
      const title = file.basename.replace(/\s*\([a-f0-9]{12}\)$/, '');
      const queue: PlayItem[] = tracks.map((track, i) => ({
        id: `family:${id}:${i}`, title,
        sub: `Kokoro narration · original story${tracks.length > 1 ? ` · Part ${i + 1} of ${tracks.length}` : ''}`,
        searchQuery: title,
        resolveUrl: async () => {
          if (!(await this.io.ensure(track.path))) throw Error('Recording unavailable');
          const url = this.io.resource(track.path);
          if (!url) throw Error('Recording unavailable');
          return url;
        },
      }));
      this.music.play(queue, 0);
    } catch {
      new Notice('Could not reach the saved narration. Check the family connection and try again.');
    } finally { this.loading = false; notice.hide(); }
  }
}
