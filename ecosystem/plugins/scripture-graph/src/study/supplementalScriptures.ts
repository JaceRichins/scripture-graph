import { enochChapterNumber, isEnochPage } from './enoch';
import { commandmentsChapterNumber, isCommandmentsPage } from './commandments';

/** Supplemental scripture editions share every scripture routing gate. */
export function isSupplementalPage(path: string): boolean {
  return isEnochPage(path) || isCommandmentsPage(path);
}
export function supplementalChapterNumber(title: string): number | null {
  return enochChapterNumber(title) ?? commandmentsChapterNumber(title);
}
