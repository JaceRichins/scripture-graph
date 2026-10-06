import { MarkdownRenderChild, MarkdownRenderer, TFile, type App, type Plugin } from 'obsidian';
import { COMMANDMENTS_FOLDER, commandmentsChapterNumber } from './commandments';

export const COMMANDMENTS_STUDY_FOLDER = 'Library/Scriptures/Book of Commandments';
export function commandmentsStudyPath(title: string): string { return `${COMMANDMENTS_STUDY_FOLDER}/${title} - My Notes.md`; }

/** Read the existing downloaded Markdown without changing a word or rewriting notes.
 * Continuation paragraphs stay inside their numbered verse for shared theme tools. */
export function commandmentsReadingBody(raw: string): string {
  let body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  body = body.replace(/^\s*# [^\n]*\n/, '').replace(/^\s*1833 edition\s*\n/, '');
  body = body.replace(/^\s*> Printing of this chapter[^\n]*\n/, '');
  body = body.split(/\n---\s*\n|\n## Related scripture passages\s*\n/)[0]!.trim();
  // From chapter 31 onward the printer left the opening verse number implicit.
  // Keep the heading separate and expose verse 1 to the same study controls.
  if (!/^\*\*1\*\* /m.test(body) && /^A Revelation\b/.test(body)) {
    const firstBreak = body.indexOf('\n\n');
    if (firstBreak >= 0) body = body.slice(0, firstBreak) + '\n\n**1** ' + body.slice(firstBreak + 2);
  }
  const labels = [...body.matchAll(/^\*\*(\d+)\*\* /gm)];
  if (!labels.length) return body;
  const out = [body.slice(0, labels[0]!.index).trim()];
  const seen = new Set<number>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!, n = Number(label[1]);
    const text = body.slice(label.index! + label[0].length, labels[i + 1]?.index ?? body.length).trim();
    const lines = text.replace(/\r?\n\s*\r?\n/g, '\n').replace(/\r?\n/g, '  \n');
    // Do not silently merge annotations if a source repeats a printed label.
    out.push(seen.has(n) ? `${n}\\. ${lines}` : `**${n}** ${lines}`);
    seen.add(n);
  }
  return out.filter(Boolean).join('\n\n');
}

export function commandmentsStudyTemplate(title: string): string {
  const chapter = commandmentsChapterNumber(title);
  if (chapter === null) throw new Error('Unknown Commandments chapter');
  const contents = `${COMMANDMENTS_FOLDER}/Book of Commandments (1833)`;
  const nav = [chapter > 1 ? `[[${COMMANDMENTS_FOLDER}/Book of Commandments ${chapter - 1}|◀ Previous chapter]]` : '',
    `[[${contents}|📚 Book of Commandments]]`, chapter < 65 ? `[[${COMMANDMENTS_FOLDER}/Book of Commandments ${chapter + 1}|Next chapter ▶]]` : ''].filter(Boolean).join(' · ');
  return `---\nownership: personal\nmutable: user\ncontent_type: personal-notes\nbook: Book of Commandments\nchapter: ${chapter}\nslug: commandments-${chapter}\ncssclasses:\n- sg-personal\n---\n\n# ${title} — My Study\n\n> [!tip]- Views & navigation\n> ${nav}\n> [[${contents}|About this edition]] · [[Study Hub|🏠 Study Hub]]\n\n\`\`\`sg-commandments\n${chapter}\n\`\`\`\n\n${nav}\n\n## ✍️ My Notes\n`;
}

const creating = new Map<string, Promise<TFile>>();
export async function ensureCommandmentsStudy(app: App, title: string): Promise<TFile> {
  const path = commandmentsStudyPath(title);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;
  if (creating.has(path)) return creating.get(path)!;
  const work = (async () => {
    const parts = COMMANDMENTS_STUDY_FOLDER.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const folder = parts.slice(0, i).join('/');
      if (!app.vault.getAbstractFileByPath(folder)) {
        try { await app.vault.createFolder(folder); } catch (e) { if (!app.vault.getAbstractFileByPath(folder)) throw e; }
      }
    }
    return app.vault.create(path, commandmentsStudyTemplate(title));
  })();
  creating.set(path, work);
  try { return await work; } finally { creating.delete(path); }
}

export function registerCommandmentsStudy(plugin: Plugin, ensureLocal: (path: string) => Promise<boolean>): void {
  plugin.registerMarkdownCodeBlockProcessor('sg-commandments', async (source, el, ctx) => {
    const chapter = commandmentsChapterNumber(`Book of Commandments ${source.trim()}`);
    if (chapter === null) { el.setText('Unknown Commandments chapter.'); return; }
    const path = `${COMMANDMENTS_FOLDER}/Book of Commandments ${chapter}.md`;
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
      const text = commandmentsReadingBody(await plugin.app.vault.cachedRead(file));
      el.addClass('sg-commandments-reading');
      const edition = el.createDiv({ cls: 'sg-voice' });
      edition.createSpan({ cls: 'sg-voice-who', text: 'Book of Commandments' });
      edition.createSpan({ cls: 'sg-voice-where', text: ' · 1833 printed edition' });
      if (chapter === 65) el.createEl('p', { cls: 'sg-nav-gsub', text: 'The original printing stops partway through this chapter.' });
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
