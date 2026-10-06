import type { FolderListing } from './navigator';

export const CFM_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
type Page = FolderListing['files'][number];
export interface CfmLesson { file: Page; month: number; order: number; dates: string; title: string }
const months = CFM_MONTHS.join('|');
const datesPattern = new RegExp(`^(${months})\\s+(\\d{1,2})(?:\\s*[–—-]\\s*(?:(${months})\\s+)?(\\d{1,2}))?(?:\\.|(?=\\s))\\s*`, 'i');

/** Dates in the published lesson titles work for downloaded and remote pages.
 * A December–January opening week belongs at the start of its manual's year. */
export function groupCfmLessons(files: Page[], year: number) {
  const lessons: CfmLesson[] = [], resources: Page[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    const match = datesPattern.exec(file.name);
    if (!match) { resources.push(file); continue; }
    const month = CFM_MONTHS.findIndex(m => m.toLowerCase() === match[1]!.toLowerCase());
    const endMonth = match[3] ? CFM_MONTHS.findIndex(m => m.toLowerCase() === match[3]!.toLowerCase()) : month;
    const day = Number(match[2]), endDay = Number(match[4] ?? match[2]);
    const openingWeek = month === 11 && endMonth === 0;
    const startYear = year - (openingWeek ? 1 : 0);
    const validDay = (y: number, m: number, d: number) => d >= 1 && d <= new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    if (!validDay(startYear, month, day) || !validDay(year, endMonth, endDay)) { resources.push(file); continue; }
    lessons.push({file, month: openingWeek ? 0 : month, order: Date.UTC(startYear, month, day),
      dates: match[0].trim().replace(/\.$/, ''), title: file.name.slice(match[0].length).trim() || file.name});
  }
  lessons.sort((a,b) => a.order - b.order || a.file.name.localeCompare(b.file.name));
  resources.sort((a,b) => a.name.localeCompare(b.name));
  return {lessons, resources};
}

interface ShelfHost {
  listFolder(path: string): FolderListing;
  openPath(path: string): void;
  go(path: string, title: string): void;
  cover(grid: HTMLElement, label: string, onTap: () => void): void;
  offline?(root: HTMLElement, path: string): void;
}

/** Virtual month shelves keep the actual document paths and existing links. */
export function renderComeFollowMeShelf(root: HTMLElement, path: string, base: string, host: ShelfHost): boolean {
  if (path !== base && !path.startsWith(base + '/')) return false;
  const parts = path.slice(base.length).split('/').filter(Boolean);
  const tileGrid = () => root.createDiv({cls:'sg-nav-covers sg-cfm-months'});
  if (!parts.length) {
    root.createEl('p', {cls:'sg-collection-description', text:'Choose a year, then a month, to find your weekly lesson.'});
    const listing = host.listFolder(base);
    const grid = tileGrid();
    for (const folder of [...listing.folders].sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}))) {
      host.cover(grid, folder.name, () => host.go(folder.path, folder.name));
    }
    if (!listing.folders.length) root.createEl('p',{text:'The lesson catalog is still loading. Please try again shortly.'});
    return true;
  }
  if (!/^\d{4}$/.test(parts[0]!) || parts.length > 2) return false;
  const year = Number(parts[0]), yearPath = `${base}/${parts[0]}`;
  const selection = parts[1];
  const month = selection ? CFM_MONTHS.findIndex((name,i) => selection === `${String(i+1).padStart(2,'0')} ${name}`) : -1;
  if (selection && month < 0 && selection !== 'Resources') return false;
  const listing = host.listFolder(yearPath);
  const {lessons, resources} = groupCfmLessons(listing.files, year);
  if (!selection) {
    root.createEl('p',{cls:'sg-collection-description',text:'Choose a month to see its lessons in date order.'});
    const grid = tileGrid();
    for (let i=0; i<12; i++) {
      if (!lessons.some(lesson => lesson.month === i)) continue;
      const name = CFM_MONTHS[i]!;
      host.cover(grid, name, () => host.go(`${yearPath}/${String(i+1).padStart(2,'0')} ${name}`, `${name} ${year}`));
    }
    if (resources.length || listing.folders.length) host.cover(grid, 'Resources', () => host.go(`${yearPath}/Resources`, `Resources · ${year}`));
    if (!listing.files.length && !listing.folders.length) root.createEl('p',{text:'The lesson catalog is still loading. Please try again shortly.'});
    host.offline?.(root, yearPath);
    return true;
  }
  if (selection === 'Resources') root.createEl('p',{cls:'sg-collection-description',text:'Teaching helps, appendices, and background reading.'});
  const list = root.createDiv({cls:'sg-collection-list sg-cfm-lessons'});
  const row = (title: string, description: string, open: () => void) => {
    const button = list.createEl('button',{cls:'sg-collection-row sg-cfm-lesson'});
    const copy = button.createSpan({cls:'sg-collection-copy'});
    if (description) copy.createSpan({cls:'sg-cfm-lesson-date',text:description});
    copy.createSpan({cls:'sg-collection-title',text:title});
    button.createSpan({text:'›',attr:{'aria-hidden':'true'}});
    button.onclick = open;
  };
  if (selection === 'Resources') {
    for (const folder of listing.folders) row(folder.name, '', () => host.go(folder.path, folder.name));
    for (const file of resources) row(file.name, '', () => host.openPath(file.path));
  } else {
    for (const lesson of lessons.filter(lesson => lesson.month === month)) {
      row(lesson.title, lesson.dates, () => host.openPath(lesson.file.path));
    }
  }
  if (!list.childElementCount) list.createEl('p',{text:'No lessons available here yet.'});
  return true;
}
