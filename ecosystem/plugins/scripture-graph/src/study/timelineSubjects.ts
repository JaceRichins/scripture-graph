import type { TimelineData, TimelineEvent } from './timelineView';
import { eventThreadIds } from './timelineMetadata';

export const SUBJECT_META = {
  people: { emoji: '🧑', label: 'People' },
  places: { emoji: '🗺', label: 'Places' },
  events: { emoji: '📅', label: 'Events' },
  topics: { emoji: '💡', label: 'Gospel topics' },
  doctrines: { emoji: '🕊', label: 'Doctrines' },
  things: { emoji: '📜', label: 'Sacred records & objects' },
  books: { emoji: '📖', label: 'Scripture books' },
  storylines: { emoji: '🧵', label: 'Storylines' },
  categories: { emoji: '🧭', label: 'Event types' },
  sources: { emoji: '🏛', label: 'Historical documents' },
} as const;
export type SubjectKind = keyof typeof SUBJECT_META;
export const SUBJECT_KINDS = Object.keys(SUBJECT_META) as SubjectKind[];
export interface Subject { kind: SubjectKind; name: string }
export interface SubjectLink extends Subject { path: string; reference: string; via?: string }
export const EVENT_TYPES: Record<string, string> = { prophets: 'Prophets', visions: 'Visions', wars: 'Wars', rulers: 'Rulers', journeys: 'Journeys', temples: 'Temples', records: 'Records', turning: 'Turning points' };

/** Add selectable facets to old and new datasets without altering their dates. */
export function prepareTimelineSubjects(data: TimelineData): TimelineData {
  const threads = new Map((data.threads ?? []).map(t => [t.id, t.label]));
  return { ...data, events: data.events.map(event => ({ ...event,
    events: [event.t],
    books: [...new Set((event.chapters ?? []).map(chapter => /^Official Declaration \d+$/.test(chapter) || /^D&C \d+$/.test(chapter)
      ? 'Doctrine and Covenants' : chapter.replace(/ \d+$/, '')))],
    storylines: eventThreadIds(event).flatMap(id => threads.has(id) ? [threads.get(id)!] : []),
    categories: (event.cat ?? []).map(key => EVENT_TYPES[key] ?? key),
  })) };
}

export function timelineSubjects(events: TimelineEvent[]): (Subject & { n: number })[] {
  const counts = new Map<string, Subject & { n: number }>();
  for (const event of events) for (const kind of SUBJECT_KINDS) for (const name of new Set(event[kind] ?? [])) {
    const key = JSON.stringify([kind, name]);
    const row = counts.get(key) ?? { kind, name, n: 0 }; row.n++; counts.set(key, row);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
