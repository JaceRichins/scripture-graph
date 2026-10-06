export const ENOCH_VOLUME = 'Book of Enoch';
export const ENOCH_FOLDER = 'AI Library/01 Scriptures/Book of Enoch';
export function isEnochPage(path: string): boolean { return path.startsWith(`${ENOCH_FOLDER}/`); }
export function enochChapterNumber(title: string): number | null {
  const match = /^1 Enoch (\d+)$/.exec(title);
  const n = match ? Number(match[1]) : 0;
  return n >= 1 && n <= 108 ? n : null;
}
export function adjacentEnochChapter(title: string, direction: 1 | -1): string | null {
  const chapter = enochChapterNumber(title);
  if (chapter === null) return null;
  const next = chapter + direction;
  return next >= 1 && next <= 108 ? `1 Enoch ${next}` : null;
}
export function renderEnochChapters(parent: HTMLElement, open: (path: string) => void): void {
  parent.createDiv({ cls: 'sg-nav-gsub', text: '1 Enoch · R. H. Charles translation · 1917 edition' });
  const contents = parent.createEl('button', { cls: 'sg-nav-row', text: 'About this edition and contents' });
  contents.onclick = () => open(`${ENOCH_FOLDER}/Book of Enoch (1 Enoch).md`);
  const grid = parent.createDiv({ cls: 'sg-nav-chapters' });
  for (let n = 1; n <= 108; n++) {
    const button = grid.createEl('button', { cls: 'sg-nav-ch', text: String(n) });
    button.setAttribute('aria-label', `1 Enoch chapter ${n}`);
    button.onclick = () => open(`${ENOCH_FOLDER}/1 Enoch ${n}.md`);
  }
}
