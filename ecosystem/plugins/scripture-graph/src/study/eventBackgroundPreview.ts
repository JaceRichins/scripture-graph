import { Modal, type App } from 'obsidian';
import { SCENE_CATALOG } from './sceneCatalog';
import type { EventBackground } from './eventBackgrounds';

export class EventBackgroundPreview extends Modal {
  private generation = 0;
  constructor(app: App, private row: EventBackground, private photo: (id: string, wide: boolean) => Promise<string>, private openChapter?: (title: string) => void) { super(app); }
  onOpen() {
    this.modalEl.addClass('sg-event-preview-modal');
    this.contentEl.createEl('h2', { text: this.row.chapter });
    this.contentEl.createEl('p', { text: this.row.name });
    const controls = this.contentEl.createDiv({ cls: 'sg-event-pagination' });
    const stage = this.contentEl.createDiv({ cls: 'sg-event-preview-stage' });
    const show = async (wide: boolean) => {
      const generation = ++this.generation;
      stage.empty(); const status = stage.createEl('p', { text: 'Loading photo…' });
      try {
        const url = await this.photo(this.row.scene, wide);
        if (generation !== this.generation) return;
        stage.empty();
        const img = stage.createEl('img', { attr: { src: url, alt: this.row.name } });
        img.onerror = () => { img.remove(); stage.createEl('p', { text: 'Photo unavailable. Try opening the preview again.' }); };
      } catch {
        if (generation !== this.generation) return;
        status.setText('Photo unavailable. Connect to download this background.');
        stage.createEl('button', { text: 'Retry' }).onclick = () => void show(wide);
      }
      portrait.setAttribute('aria-pressed', String(!wide)); landscape?.setAttribute('aria-pressed', String(wide));
    };
    const portrait = controls.createEl('button', { text: 'Portrait' });
    portrait.onclick = () => void show(false);
    const landscape = SCENE_CATALOG[this.row.scene]?.wide ? controls.createEl('button', { text: 'Landscape' }) : null;
    if (landscape) landscape.onclick = () => void show(true);
    if (this.openChapter) this.contentEl.createEl('button', { cls: 'mod-cta', text: 'Open chapter' }).onclick = () => { this.close(); this.openChapter?.(this.row.chapter); };
    void show(false);
  }
  onClose() { this.generation++; this.contentEl.empty(); }
}
