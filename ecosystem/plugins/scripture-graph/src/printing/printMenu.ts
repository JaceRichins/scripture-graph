import { App, Component, MarkdownRenderer, Menu, Modal, Notice, Platform, TFile } from 'obsidian';
import { filePage, lessonFolder, lessonPages, printMarkdown, type PrintPage } from './printContent';
import { cleanPrintHtml, createPrintPdf, type PrintOptions } from './printPdf';

const printCss = `@page{margin:16mm}*{box-sizing:border-box}body{margin:0;padding:24px;background:white;color:#111;font:13pt/1.5 Arial,sans-serif;overflow-wrap:anywhere}h1,h2,h3{line-height:1.2;break-after:avoid}h1{font-size:1.7em}h2{font-size:1.3em;margin-top:1.4em}p,li{orphans:3;widows:3}table{border-collapse:collapse;width:100%;font-size:.9em}th,td{border:1px solid #aaa;padding:6px;text-align:left}blockquote{margin-left:0;border-left:2px solid #aaa;padding-left:14px}a{color:#222}pre{white-space:pre-wrap}article+article{break-before:page;margin-top:30px}img{max-width:100%}@media print{body{padding:0}article+article{margin-top:0}}`;
const safeTitle = (s: string) => s.replace(/[<>:"/\\|?*#^\[\]]/g, '').trim().slice(0, 80) || 'Lesson';

export function addPrintItems(menu: Menu, app: App, file: TFile): void {
  if (file.extension !== 'md') return;
  menu.addItem(item => item.setTitle('Print page…').setIcon('printer').onClick(() => void openPagePrint(app, file)));
  const folder = lessonFolder(file.path);
  if (folder) addLessonPrintItem(menu, app, folder);
}

export function addLessonPrintItem(menu: Menu, app: App, folder: string): void {
  if (lessonFolder(folder) !== folder) return;
  menu.addItem(item => item.setTitle(folder.startsWith('Library/Study Plans/') ? 'Print full study plan…' : folder.startsWith('Library/Research/') ? 'Print full research…' : 'Print full lesson…').setIcon('printer').onClick(() => void openLessonPrint(app, folder)));
}

export async function openPagePrint(app: App, file: TFile): Promise<void> {
  try { new PrintModal(app, [await filePage(app, file)]).open(); }
  catch (error) { new Notice(`Couldn't prepare printing: ${(error as Error).message}`); }
}

export async function openLessonPrint(app: App, folder: string): Promise<void> {
  try {
    const pages = await lessonPages(app, folder);
    if (!pages.length) throw new Error('No document pages are available on this device yet.');
    new PrintModal(app, pages).open();
  } catch (error) { new Notice(`Couldn't prepare printing: ${(error as Error).message}`); }
}

/** The only print controls live in this deliberately opened preview. */
export class PrintModal extends Modal {
  private renderer = new Component();
  private generation = 0;
  private closed = false;
  private frame!: HTMLIFrameElement;
  private action!: HTMLButtonElement;
  private save!: HTMLButtonElement;
  private status!: HTMLElement;
  private selected: Set<number>;
  private options: PrintOptions = { fontSize: 13, paper: 'LETTER' };
  private readyFile: File | null = null;

  constructor(app: App, private pages: PrintPage[]) {
    super(app);
    this.selected = new Set(pages.flatMap((p, i) => p.selected === false ? [] : [i]));
  }

  onOpen(): void {
    this.renderer.load();
    this.modalEl.addClass('sg-print-modal');
    this.setTitle(this.pages.length > 1 ? 'Print documents' : 'Print page');
    const root = this.contentEl;
    if (this.pages.length > 1) {
      const choices = root.createEl('details', { cls: 'sg-print-choices' });
      choices.createEl('summary', { text: 'Pages to include' });
      this.pages.forEach((page, i) => {
        const label = choices.createEl('label');
        const check = label.createEl('input', { type: 'checkbox' });
        check.checked = this.selected.has(i);
        label.createSpan({ text: page.title });
        check.onchange = () => { check.checked ? this.selected.add(i) : this.selected.delete(i); this.invalidate(); };
      });
    }
    const controls = root.createDiv({ cls: 'sg-print-options' });
    const sizeLabel = controls.createEl('label', { text: 'Text size ' });
    const size = sizeLabel.createEl('select');
    for (const [value, label] of [[13, 'Standard'], [16, 'Large'], [18, 'Extra large']] as const) size.createEl('option', { value: String(value), text: label });
    size.onchange = () => { this.options.fontSize = Number(size.value); this.invalidate(); };
    const paperLabel = controls.createEl('label', { text: 'Paper ' });
    const paper = paperLabel.createEl('select');
    for (const value of ['LETTER', 'A4'] as const) paper.createEl('option', { value, text: value === 'LETTER' ? 'US Letter' : 'A4' });
    paper.onchange = () => { this.options.paper = paper.value as PrintOptions['paper']; this.invalidate(); };
    this.status = root.createEl('p', { cls: 'sg-print-status', attr: { role: 'status' } });
    const actions = root.createDiv({ cls: 'sg-print-options' });
    this.action = actions.createEl('button', { text: 'Prepare print preview', cls: 'mod-cta' });
    this.action.onclick = () => {
      if (!this.readyFile) { void this.prepare(); return; }
      if (!Platform.isMobile) {
        try { this.frame.contentWindow?.focus(); this.frame.contentWindow?.print(); }
        catch { this.status.setText('Use Save PDF below, then print from your PDF viewer.'); }
        return;
      }
      // Keep share directly inside the fresh tap: iOS requires user activation.
      if (navigator.canShare?.({ files: [this.readyFile] }) && navigator.share) {
        void navigator.share({ files: [this.readyFile] }).catch(error => {
          if (error?.name !== 'AbortError') this.status.setText('Could not open printing. Try again, or save the PDF below.');
        });
      } else { void this.savePdf(); }
    };
    this.save = actions.createEl('button', { text: 'Save PDF', attr: { 'aria-label': 'Save printable PDF to the vault' } });
    this.save.disabled = true;
    this.save.onclick = () => void this.savePdf();
    this.frame = root.createEl('iframe', { cls: 'sg-print-preview', attr: { title: 'Print preview', sandbox: 'allow-same-origin allow-modals' } });
    void this.prepare();
  }

  private invalidate(): void {
    ++this.generation;
    this.readyFile = null;
    this.save.disabled = true;
    this.action.disabled = this.selected.size === 0;
    this.action.setText('Prepare print preview');
    this.status.setText(this.selected.size ? 'Choices changed. Prepare the updated print preview.' : 'Select at least one page.');
  }

  private async prepare(): Promise<void> {
    const current = ++this.generation;
    this.action.disabled = true;
    this.save.disabled = true;
    this.readyFile = null;
    this.status.setText('Preparing all selected pages…');
    try {
      const selected = this.pages.filter((_p, i) => this.selected.has(i));
      if (!selected.length) throw new Error('Select at least one page.');
      const rendered: { title: string; html: string }[] = [];
      for (const page of selected) {
        const root = document.createElement('div');
        await MarkdownRenderer.render(this.app, printMarkdown(page.markdown), root, page.path, this.renderer);
        if (!root.querySelector('h1')) root.prepend(Object.assign(document.createElement('h1'), { textContent: page.title }));
        rendered.push({ title: page.title, html: cleanPrintHtml(root) });
      }
      const blob = await createPrintPdf(rendered, this.options);
      if (this.closed || current !== this.generation) return;
      this.readyFile = new File([blob], `${safeTitle(selected[0]!.title)}.pdf`, { type: 'application/pdf' });
      // A same-origin, script-free print document works in Electron without
      // reaching through the PDF viewer's separate extension origin.
      this.frame.srcdoc = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${printCss}@page{size:${this.options.paper === 'LETTER' ? 'Letter' : 'A4'};margin:42pt}body{font-size:${this.options.fontSize}pt}</style>${rendered.map(p => `<article>${p.html}</article>`).join('')}`;
      const shareable = Platform.isMobile && navigator.canShare?.({ files: [this.readyFile] });
      this.status.setText(`${selected.length} document${selected.length === 1 ? '' : 's'} ready. Text and sources, without background photos. ${Platform.isMobile ? shareable ? 'Continue, then choose Print in the share sheet.' : 'Save the PDF, then use your PDF viewer’s Print option.' : 'Print all pages or choose a page range in the print dialog.'}`);
      this.action.setText(Platform.isMobile ? shareable ? 'Continue to print' : 'Save & open PDF' : 'Print…');
      this.action.disabled = false;
      this.save.disabled = false;
    } catch (error) {
      if (this.closed || current !== this.generation) return;
      this.status.setText(`Couldn't prepare printing: ${(error as Error).message}`);
      this.action.setText('Try again'); this.action.disabled = false;
    }
  }

  private async savePdf(): Promise<void> {
    if (!this.readyFile) return;
    this.save.disabled = true;
    try {
      const dir = 'Library/Printouts';
      if (!this.app.vault.getAbstractFileByPath(dir)) await this.app.vault.createFolder(dir);
      const stem = `${dir}/${safeTitle(this.readyFile.name.replace(/\.pdf$/, ''))}`;
      let path = `${stem}.pdf`, n = 2;
      while (this.app.vault.getAbstractFileByPath(path)) path = `${stem} (${n++}).pdf`;
      const file = await this.app.vault.createBinary(path, await this.readyFile.arrayBuffer());
      await this.app.workspace.getLeaf('tab').openFile(file);
      new Notice('PDF saved. Use the PDF viewer’s print or share menu.');
      this.close();
    } catch (error) { this.status.setText(`Couldn't save the PDF: ${(error as Error).message}`); this.save.disabled = false; }
  }

  onClose(): void {
    this.closed = true; ++this.generation;
    this.renderer.unload();
    this.readyFile = null;
    this.contentEl.empty();
  }
}
