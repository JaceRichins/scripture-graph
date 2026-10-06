import { Modal, Notice, type Menu, type TFile } from 'obsidian';
import { shareablePage, type PageRecipient, type SharedPage, type SentPage } from '@scripture-graph/core-sdk';
import type { SGState } from '../state';

/** Both native file menus and custom readers use the current page's picker. */
export function addSendPageItem(menu: Menu, s: SGState, file: TFile): void {
  if (!shareablePage(file.path)) return;
  menu.addItem(item => item.setTitle('Send page…').setIcon('send').onClick(() => sendPage(s, file)));
}

export function sendPage(s: SGState, file: TFile): void {
  if (!s.signedIn) { new Notice('Sign in to send a page to your family.'); return; }
  if (!shareablePage(file.path)) { new Notice('Choose a page from the shared family library.'); return; }
  new SendPageModal(s, file).open();
}

export class SendPageModal extends Modal {
  private attempt: { key: string; id: string } | null = null;
  constructor(private s: SGState, private file: TFile) { super(s.app); }
  async onOpen(): Promise<void> {
    const c = this.contentEl; c.empty(); c.addClass('sg-family-share');
    c.createEl('h2', { text: 'Send page' });
    c.createEl('p', { text: this.file.basename });
    c.createEl('p', { text: 'Choose who should receive this page.' });
    const status = c.createEl('p', { text: 'Loading family members…' });
    let people: PageRecipient[];
    try { people = (await this.s.api.pageRecipients()).recipients; }
    catch { status.setText('Could not connect.'); const retry = c.createEl('button', { text: 'Retry' }); retry.onclick = () => void this.onOpen(); return; }
    if (!c.isConnected) return;
    status.remove();
    if (!people.length) { c.createEl('p', { text: 'No other family group members are available yet.' }); return; }
    const chosen = new Set<string>();
    const list = c.createDiv({ cls: 'sg-family-recipients' });
    const checks: HTMLInputElement[] = [];
    for (const person of people) {
      const row = list.createEl('label', { cls: 'sg-family-recipient' });
      const check = row.createEl('input', { type: 'checkbox' }); checks.push(check);
      row.createSpan({ text: person.display_name });
      check.onchange = () => { if (check.checked) chosen.add(person.user_id); else chosen.delete(person.user_id); send.disabled = !chosen.size; };
    }
    const label = c.createEl('label', { text: 'Message (optional)' });
    const message = label.createEl('textarea', { attr: { maxlength: '1000', rows: '3', placeholder: 'Thought you would enjoy this…' } });
    const error = c.createEl('p', { attr: { role: 'status' } });
    const send = c.createEl('button', { cls: 'mod-cta', text: 'Send page' }); send.disabled = true;
    let sending = false;
    send.onclick = async () => {
      if (sending || !chosen.size) return;
      sending = true; send.disabled = true; message.disabled = true; checks.forEach(check => check.disabled = true);
      const payload = { recipients: [...chosen].sort(), path: this.file.path, message: message.value.trim() };
      const key = JSON.stringify(payload);
      if (this.attempt?.key !== key) this.attempt = { key, id: crypto.randomUUID() };
      error.setText('Sending…');
      try {
        await this.s.api.sendPage({ ...payload, request_id: this.attempt.id });
        new Notice(`Sent to ${people.filter(p => chosen.has(p.user_id)).map(p => p.display_name).join(', ')}`);
        this.close();
      } catch (e) { error.setText(`Not confirmed sent. Retry safely: ${(e as Error).message}`); }
      finally { sending = false; send.disabled = !chosen.size; message.disabled = false; checks.forEach(check => check.disabled = false); }
    };
  }
  onClose(): void { this.contentEl.empty(); }
}

export class FamilyInboxModal extends Modal {
  private direction: 'incoming' | 'sent' = 'incoming';
  private generation = 0;
  constructor(private s: SGState, private openPage: (path: string) => Promise<void>) { super(s.app); }
  async onOpen(): Promise<void> {
    const c = this.contentEl; c.empty(); c.addClass('sg-family-share');
    c.createEl('h2', { text: 'Family inbox' });
    const tabs = c.createDiv({ cls: 'sg-family-inbox-tabs', attr: { role: 'group', 'aria-label': 'Page folders' } });
    const incoming = tabs.createEl('button', { text: 'Incoming' });
    const sent = tabs.createEl('button', { text: 'Sent' });
    const select = async (direction: 'incoming' | 'sent') => {
      this.direction = direction;
      incoming.setAttr('aria-pressed', String(direction === 'incoming'));
      sent.setAttr('aria-pressed', String(direction === 'sent'));
      list.empty();
      await this.load(list, incoming);
    };
    incoming.onclick = () => void select('incoming');
    sent.onclick = () => void select('sent');
    const refresh = c.createEl('button', { text: 'Refresh', cls: 'sg-family-inbox-refresh' });
    refresh.onclick = () => void select(this.direction);
    const list = c.createDiv();
    await select(this.direction);
  }
  private async load(list: HTMLElement, incoming: HTMLButtonElement, before?: number): Promise<void> {
    const generation = ++this.generation;
    const direction = this.direction;
    const current = () => generation === this.generation && list.isConnected;
    const status = list.createEl('p', { text: `Loading ${direction} pages…`, attr: { role: 'status' } });
    try {
      const result = direction === 'sent' ? await this.s.api.pageSent(before) : await this.s.api.pageInbox(before);
      if (!current()) return;
      status.remove();
      if ('unread' in result) incoming.setText(result.unread ? `Incoming · ${result.unread} new` : 'Incoming');
      if (!before && !result.items.length) list.createEl('p', { text: direction === 'sent'
        ? 'Pages you send to family members will appear here.' : 'Pages your family sends you will appear here.' });
      for (const item of result.items) this.row(list, item, direction);
      if (result.next) {
        const more = list.createEl('button', { text: 'Older pages' });
        more.onclick = () => { more.remove(); void this.load(list, incoming, result.next!); };
      }
    } catch {
      if (!current()) return;
      status.setText(`Could not load ${direction} pages. Reconnect and try again.`);
      const retry = list.createEl('button', { text: 'Retry' });
      retry.onclick = () => { status.remove(); retry.remove(); void this.load(list, incoming, before); };
    }
  }
  private row(list: HTMLElement, item: SharedPage | SentPage, direction: 'incoming' | 'sent'): void {
    const card = list.createDiv({ cls: 'sg-family-inbox-item' });
    const person = 'recipient_name' in item ? `To ${item.recipient_name}` : `${item.read_at ? '' : 'New · '}From ${item.sender_name}`;
    card.createDiv({ cls: 'sg-family-inbox-from', text: `${person} · ${new Date(item.created_at).toLocaleString()}` });
    if (direction === 'sent') card.createDiv({ cls: 'sg-family-inbox-from', text: item.read_at ? `Opened ${new Date(item.read_at).toLocaleString()}` : 'Sent' });
    const open = card.createEl('button', { cls: 'sg-family-page-title', text: item.title });
    if (item.message) card.createEl('p', { text: item.message });
    const status = card.createEl('div', { attr: { role: 'status' } });
    open.onclick = async () => {
      open.disabled = true; status.setText('Opening page…');
      try {
        await this.openPage(item.path);
        if (direction === 'incoming') {
          try { await this.s.api.readSharedPage(item.id); } catch { /* keep unread if receipt fails */ }
        }
        this.close();
      } catch { status.setText('Could not open this page. Reconnect and try again.'); open.disabled = false; }
    };
  }
  onClose(): void { ++this.generation; this.contentEl.empty(); }
}

/** A permanent door, even before the first message has arrived. */
export function familyInboxButton(parent: HTMLElement, s: SGState, open: () => void): void {
  const button = parent.createEl('button', { cls: 'sg-family-inbox-button', text: 'Family inbox' });
  button.onclick = open;
  if (s.signedIn) void s.api.pageInbox().then(result => {
    if (button.isConnected && result.unread) button.setText(`Family inbox · ${result.unread} new`);
  }).catch(() => { /* door remains available; inbox shows connection feedback */ });
}
