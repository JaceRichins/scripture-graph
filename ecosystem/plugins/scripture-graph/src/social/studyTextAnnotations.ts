import { textHash } from '@scripture-graph/core-sdk';
import type { SGState } from '../state';
import { decorateVerse, type AnnotationService } from './annotations';

/** Stable across embeds, section rendering and paragraph reordering. A changed
 * paragraph gets a different anchor instead of applying an old mark elsewhere. */
export function studyTextAnchor(path: string, text: string): string {
  const hash = (value: string) => textHash(value) + textHash(Array.from(value).reverse().join(''));
  return `study:${hash(path)}:${hash(text.replace(/\s+/g, ' ').trim())}`;
}

export async function decorateStudyText(root: HTMLElement, path: string, s: SGState, ann: AnnotationService): Promise<void> {
  const title = path.split('/').pop()!.replace(/\.md$/, '');
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('p,li,td'));
  if (root.matches('p,li,td')) blocks.unshift(root);
  for (const block of blocks) {
    if (block.querySelector('p,li,td') || block.closest('pre,code,.frontmatter,.metadata-container') || block.hasAttribute('data-verse-id')) continue;
    const embed = block.closest('.internal-embed');
    if (embed && root.contains(embed)) continue; // nested sources own their annotations
    const copy = block.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.sgh-note-icon,.sg-badge,.sg-theme-badges').forEach(el => el.remove());
    const text = copy.textContent?.trim() ?? '';
    if (text.length < 3) continue;
    const anchor = studyTextAnchor(path, text);
    block.setAttribute('data-sg-study-block', 'true');
    block.setAttribute('data-sg-doc-anchor', anchor);
    block.setAttribute('data-sg-doc-path', path);
    block.setAttribute('data-sg-doc-title', title);
    block.setAttribute('data-sg-study-text', text);
    decorateVerse(s, ann, block, anchor, await ann.mine(anchor), ann.social(anchor));
  }
}
