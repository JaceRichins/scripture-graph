import type { TreeData } from './familyTree';

export interface FamilySpouse { pid: string; label?: 'wife' | 'husband' | 'spouse' }

/** Recommendations include the reader's own line and explicitly linked spouse.
 * A missing identity never falls back to another family's root. */
export function relevantFamilyPeople(data: TreeData | null, viewer: string | null, spouse?: FamilySpouse): Set<string> {
  if (!data || !viewer || !data.people[viewer]) return new Set();
  return new Set(Object.keys(data.people).filter(pid => relationLabel(data, viewer, pid, spouse).kin));
}

export function relevantFamilyStories<T extends { people: { pid: string }[] }>(stories: T[], people: Set<string>): T[] {
  return stories.filter(story => story.people?.some(person => people.has(person.pid)));
}

/** An account's explicit tree identity wins. Never default another reader to Jace. */
export function familyViewer(data: TreeData, personId?: string | null, displayName?: string | null): string | null {
  if (personId && data.people[personId]) return personId;
  const words = (s: string): string[] => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z]+/g) ?? [];
  const query = words(displayName ?? '');
  if (!query.length) return null;
  const matches = Object.entries(data.people).filter(([, person]) => person.living && query.every(w => words(person.n).includes(w)));
  return matches.length === 1 ? matches[0]![0] : null;
}

type Side = 'f' | 'm';
const ancestorCache = new WeakMap<TreeData, Map<string, Map<string, Side[]>>>();
function ancestry(data: TreeData, root: string, target: string): Side[] | null {
  let roots = ancestorCache.get(data);
  if (!roots) { roots = new Map(); ancestorCache.set(data, roots); }
  const cached = roots.get(root);
  if (cached) return cached.get(target) ?? null;
  const queue: { id: string; steps: Side[] }[] = [{ id: root, steps: [] }];
  const paths = new Map<string, Side[]>([[root, []]]);
  const seen = new Set([root]);
  for (let i = 0; i < queue.length; i++) {
    const { id, steps } = queue[i]!;
    const person = data.people[id];
    if (!person) continue;
    for (const side of ['f', 'm'] as const) {
      const parent = person[side];
      if (parent && !seen.has(parent)) {
        seen.add(parent); const path = [...steps, side];
        paths.set(parent, path); queue.push({ id: parent, steps: path });
      }
    }
  }
  roots.set(root, paths);
  return paths.get(target) ?? null;
}

function ordinal(n: number): string {
  const hundred = n % 100;
  return `${n}${hundred >= 11 && hundred <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number,string>)[n % 10] ?? 'th'}`;
}

function label(steps: Side[], possessive: string): { path: string; kin: string } {
  const male = steps[steps.length - 1] === 'f';
  const grand = male ? 'grandpa' : 'grandma';
  const kin = steps.length === 1 ? (male ? 'dad' : 'mom') : steps.length === 2 ? grand
    : steps.length === 3 ? `great-${grand}` : `${ordinal(steps.length - 2)} great-${grand}`;
  const words = steps.map(s => s === 'f' ? 'dad' : 'mom');
  return { kin: `${possessive} ${kin}`, path: steps.length > 1
    ? `${possessive} ${words.map((w,i) => i < words.length - 1 ? `${w}'s` : w).join(' ')}` : '' };
}

export function relationLabel(data: TreeData, root: string | null, pid: string, spouse?: FamilySpouse): { path: string; kin: string } {
  if (!root || !data.people[root] || !data.people[pid]) return { path: '', kin: '' };
  if (pid === root) return { path: '', kin: 'you' };
  const direct = ancestry(data, root, pid);
  if (direct?.length) return label(direct, 'your');
  // Only documented spouse links qualify. Sharing a child does not prove marriage.
  const spouses = spouse ? [spouse] : data.people[root]?.spouses ?? [];
  for (const partner of spouses) {
    const name = partner.label ?? 'spouse';
    if (partner.pid === pid) return { path: '', kin: `your ${name}` };
    const steps = ancestry(data, partner.pid, pid);
    if (steps?.length) return label(steps, `your ${name}'s`);
  }
  return { path: '', kin: '' };
}
