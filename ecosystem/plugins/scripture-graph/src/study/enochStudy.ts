import { MarkdownRenderChild, MarkdownRenderer, TFile, type App, type Plugin } from 'obsidian';
import { ENOCH_FOLDER, enochChapterNumber } from './enoch';

export const ENOCH_STUDY_FOLDER = 'Library/Scriptures/Book of Enoch';
export function enochStudyPath(title: string): string { return `${ENOCH_STUDY_FOLDER}/${title} - My Notes.md`; }

/** Both shipped editions contain the same source text. Format at read time so
 * an offline phone with the original download gets the same reading surface.
 * Never rewrite the source or the reader's personal notes. */
export function enochReadingBody(raw: string): string {
  let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const legacy = /^## Full text\s*$/m.exec(body);
  body = legacy ? body.slice(legacy.index + legacy[0].length) : body.replace(/^\s*# [^\n]*\n/, '');
  body = body.split(/\n---\s*\n|\n## Related scripture passages\s*\n/)[0]!.trim();
  // Undo only our earlier verse-label formatting, not emphasis in the text.
  body = body.replace(/\*\*(\d{1,2})\.\*\*/g, '$1.');
  const labels = [...body.matchAll(/(?<!\S)(\d{1,2})\.(?=\s)/g)];
  if (!labels.length) return body;
  const out = [body.slice(0, labels[0]!.index).trim()];
  const seen = new Set<number>();
  let variants = false;
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!, n = Number(label[1]);
    if (seen.has(n) && !variants) { variants = true; out.push('### Textual variants'); }
    seen.add(n);
    const text = body.slice(label.index! + label[0].length, labels[i + 1]?.index ?? body.length).trim();
    // Poetry belongs to its verse, including all its original lines. Variants
    // keep their printed numbers but never share a main-text annotation ID.
    const lines = text.replace(/\r?\n\s*\r?\n/g, '\n').replace(/\r?\n/g, '  \n');
    out.push(variants ? `${n}\\. ${lines}` : `**${n}** ${lines}`);
  }
  return out.filter(Boolean).join('\n\n');
}

export function enochStudyTemplate(title: string): string {
  const chapter = enochChapterNumber(title);
  if (chapter === null) throw new Error('Unknown Enoch chapter');
  const contents = `${ENOCH_FOLDER}/Book of Enoch (1 Enoch)`;
  const nav = [chapter > 1 ? `[[${ENOCH_FOLDER}/1 Enoch ${chapter - 1}|◀ Previous chapter]]` : '',
    `[[${contents}|📚 Book of Enoch]]`, chapter < 108 ? `[[${ENOCH_FOLDER}/1 Enoch ${chapter + 1}|Next chapter ▶]]` : ''].filter(Boolean).join(' · ');
  return `---\nownership: personal\nmutable: user\ncontent_type: personal-notes\nbook: 1 Enoch\nchapter: ${chapter}\nslug: enoch-${chapter}\ncssclasses:\n- sg-personal\n---\n\n# ${title} — My Study\n\n> [!tip]- Views & navigation\n> ${nav}\n> [[${contents}|About this edition]] · [[Study Hub|🏠 Study Hub]]\n\n\`\`\`sg-enoch\n${chapter}\n\`\`\`\n\n${nav}\n\n## ✍️ My Notes\n`;
}

const creating = new Map<string, Promise<TFile>>();
export async function ensureEnochStudy(app: App, title: string): Promise<TFile> {
  const path = enochStudyPath(title);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  if (creating.has(path)) return creating.get(path)!;
  const work = (async () => {
    const parts = ENOCH_STUDY_FOLDER.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join('/');
      if (!app.vault.getAbstractFileByPath(folder)) {
        try { await app.vault.createFolder(folder); } catch (e) { if (!app.vault.getAbstractFileByPath(folder)) throw e; }
      }
    }
    return app.vault.create(path, enochStudyTemplate(title));
  })();
  creating.set(path, work);
  try { return await work; } finally { creating.delete(path); }
}

export function registerEnochStudy(plugin: Plugin, ensureLocal: (path: string) => Promise<boolean>): void {
  plugin.registerMarkdownCodeBlockProcessor('sg-enoch', async (source, el, ctx) => {
    const chapter = enochChapterNumber(`1 Enoch ${source.trim()}`);
    if (chapter === null) { el.setText('Unknown Enoch chapter.'); return; }
    const path = `${ENOCH_FOLDER}/1 Enoch ${chapter}.md`;
    const child = new MarkdownRenderChild(el);
    ctx.addChild(child);
    const render = async () => {
      try {
      el.empty();
      let file = plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        await ensureLocal(path);
        file = plugin.app.vault.getAbstractFileByPath(path);
      }
      if (!(file instanceof TFile)) {
        el.createEl('p', { text: 'Connect to the family server to download this chapter.' });
        el.createEl('button', { text: 'Try again' }).onclick = () => { void render(); };
        return;
      }
      const text = enochReadingBody(await plugin.app.vault.cachedRead(file));
      el.addClass('sg-enoch-reading');
      const edition = el.createDiv({ cls: 'sg-voice' });
      edition.createSpan({ cls: 'sg-voice-who', text: 'Book of Enoch' });
      edition.createSpan({ cls: 'sg-voice-where', text: ' · R. H. Charles translation · 1917' });
      await MarkdownRenderer.render(plugin.app, text, el, path, child);
      } catch {
        el.empty();
        el.createEl('p', { text: "Couldn't load this chapter. Your notes are still saved." });
        el.createEl('button', { text: 'Try again' }).onclick = () => { void render(); };
      }
    };
    await render();
  });
}
