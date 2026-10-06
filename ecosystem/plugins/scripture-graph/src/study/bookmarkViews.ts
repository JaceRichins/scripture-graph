/** 🔖 Bookmarks, in plain terms: one per page, tap the empty ribbon to add one,
 * tap the gold ribbon to see where you left off, remove only on purpose (with Undo). */
import { Modal, type App } from 'obsidian';
import { placeLabel, type Annotation } from '@scripture-graph/core-sdk';
import type { BookmarkEntry, StudyService } from './study';

export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const minutes = Math.round(Math.max(0, now - t) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString();
}

function whereText(entry: BookmarkEntry): string {
  const place = placeLabel(entry.place);
  if (!place) return 'Your place will be kept as you read this page.';
  return place === 'The top of the page' ? 'You left off at the top of the page.' : `You left off at ${place}`;
}

/** Tapping a bookmarked page's gold ribbon. */
export class BookmarkSheet extends Modal {
  constructor(app: App, private study: StudyService, private mark: Annotation, private openList: () => void) { super(app); }

  async onOpen(): Promise<void> {
    const c = this.contentEl;
    c.addClass('sg-saved');
    const entry = await this.study.entry(this.mark);
    c.createEl('h2', { text: `🔖 ${entry.title}` });
    c.createEl('p', { text: whereText(entry) });
    c.createEl('p', { cls: 'sg-nav-gsub', text: `Updated ${relativeTime(entry.at)}. Your place follows you to your other devices.` });
    const actions = c.createDiv({ cls: 'modal-button-container' });
    const all = actions.createEl('button', { text: 'All bookmarks' });
    all.onclick = () => { this.close(); this.openList(); };
    const remove = actions.createEl('button', { cls: 'mod-warning', text: 'Remove bookmark' });
    remove.onclick = async () => {
      remove.disabled = true;
      await this.study.unbookmark(this.mark);
      this.close();
    };
  }

  onClose(): void { this.contentEl.empty(); }
}

/** Holding the bookmark button: every bookmark, most recently read first. */
export class BookmarksModal extends Modal {
  constructor(app: App, private study: StudyService, private openSaved: (() => void) | null) { super(app); }

  async onOpen(): Promise<void> {
    this.modalEl.addClass('sg-lib-modal');
    const c = this.contentEl;
    c.addClass('sg-saved');
    c.createEl('h2', { text: 'Bookmarks' });
    c.createEl('p', { cls: 'sg-nav-gsub', text: 'Your place in each page is kept as you read and follows you to your other devices.' });
    const list = c.createDiv({ cls: 'sg-nav-list' });
    const entries = await this.study.bookmarks();
    if (!entries.length) list.createDiv({ cls: 'sg-nav-empty', text: 'No bookmarks yet. While reading, tap the bookmark button to keep your place in that page.' });
    for (const entry of entries) {
      const row = list.createDiv({ cls: 'sg-nav-row', attr: { role: 'button', tabindex: '0' } });
      row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.click(); } };
      row.createSpan({ cls: 'sg-saved-ico', text: '🔖' });
      const col = row.createDiv({ cls: 'sg-nav-gcol' });
      col.createDiv({ cls: 'sg-nav-name', text: entry.title });
      const place = placeLabel(entry.place);
      col.createDiv({ cls: 'sg-nav-gsub', text: [place && place !== 'The top of the page' ? place : null, `Last read ${relativeTime(entry.at)}`].filter(Boolean).join(' · ') });
      row.onclick = () => { this.close(); void this.study.openBookmark(entry); };
      const remove = row.createEl('button', { cls: 'sg-saved-x', text: '✕', attr: { 'aria-label': `Remove bookmark from ${entry.title}` } });
      remove.onclick = event => { event.stopPropagation(); row.remove(); void this.study.unbookmark(entry.mark); };
    }
    if (this.openSaved) {
      const more = c.createEl('button', { cls: 'sg-saved-keep', text: 'Continue reading, notebooks, flashcards & trails' });
      more.onclick = () => { this.close(); this.openSaved!(); };
    }
  }

  onClose(): void { this.contentEl.empty(); }
}
