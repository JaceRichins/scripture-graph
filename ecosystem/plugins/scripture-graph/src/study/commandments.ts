export const COMMANDMENTS_VOLUME = 'Book of Commandments (1833)';
export const COMMANDMENTS_FOLDER = 'AI Library/01 Scriptures/Book of Commandments';
export function isCommandmentsPage(path: string): boolean { return path.startsWith(`${COMMANDMENTS_FOLDER}/`); }
export function commandmentsChapterNumber(title: string): number | null {
  const match = /^Book of Commandments (\d+)$/.exec(title);
  const n = match ? Number(match[1]) : 0;
  return n >= 1 && n <= 65 ? n : null;
}
export function adjacentCommandmentsChapter(title: string, direction: 1 | -1): string | null {
  const chapter = commandmentsChapterNumber(title);
  if (chapter === null) return null;
  const next = chapter + direction;
  return next >= 1 && next <= 65 ? `Book of Commandments ${next}` : null;
}

export function renderCommandmentsChapters(parent: HTMLElement, open: (path: string) => void): void {
  parent.createDiv({ cls: 'sg-nav-gsub', text: '1833 edition · Historical predecessor to the D&C · Chapter 65 is incomplete in the original printing' });
  const contents = parent.createEl('button', { cls: 'sg-nav-row', text: 'About this edition and contents' });
  contents.onclick = () => open(`${COMMANDMENTS_FOLDER}/Book of Commandments (1833).md`);
  const grid = parent.createDiv({ cls: 'sg-nav-chapters' });
  for (let n = 1; n <= 65; n++) {
    const button = grid.createEl('button', { cls: 'sg-nav-ch', text: String(n) });
    button.setAttribute('aria-label', `Book of Commandments chapter ${n}${n === 65 ? ', printing incomplete' : ''}`);
    button.onclick = () => open(`${COMMANDMENTS_FOLDER}/Book of Commandments ${n}.md`);
  }
}
