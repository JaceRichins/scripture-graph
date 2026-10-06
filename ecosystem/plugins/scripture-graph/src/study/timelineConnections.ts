import type { TimelineData, TimelineEvent } from './timelineView';
import { eventThreadIds } from './timelineMetadata';

export interface TimelineConnection { a: string; b: string; kind: 'subject' | 'narrative' | 'branch'; labels: string[] }

/** Restore the source-backed web without connecting every pair in a subject. */
export function timelineConnections(events: TimelineEvent[], data: TimelineData,
  narrative: readonly (readonly [string, string])[]): TimelineConnection[] {
  const visible = new Set(events.map(e => e.id));
  const pairs = new Map<string, TimelineConnection>();
  const add = (a: string, b: string, kind: TimelineConnection['kind'], label: string) => {
    if (a === b || !visible.has(a) || !visible.has(b)) return;
    const key = JSON.stringify([a, b].sort());
    const found = pairs.get(key);
    if (found) { if (!found.labels.includes(label)) found.labels.push(label); if (kind !== 'subject') found.kind = kind; }
    else pairs.set(key, { a, b, kind, labels: [label] });
  };
  const bySubject = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    for (const [kind, names] of [['Person', e.people], ['Place', e.places], ['Subject', e.things]] as const) {
      for (const name of new Set(names ?? [])) {
        const key = `${kind}: ${name}`, chain = bySubject.get(key) ?? [];
        chain.push(e); bySubject.set(key, chain);
      }
    }
  }
  for (const [subject, chain] of bySubject) {
    // Match the existing graph's restraint around broadly shared subjects.
    if (chain.length > 9) continue;
    for (let i = 1; i < chain.length; i++) add(chain[i - 1]!.id, chain[i]!.id, 'subject', subject);
  }
  for (const [a, b] of narrative) add(a, b, 'narrative', 'Narrative connection');
  for (const edge of data.connections ?? []) add(edge.a, edge.b, 'narrative', edge.label);
  for (const thread of data.threads ?? []) {
    const members = events.filter(e => eventThreadIds(e).includes(thread.id));
    if (!members.length) continue;
    if (thread.branch) add(thread.branch, members[0]!.id, 'branch', `${thread.label} branches here`);
    if (thread.merges) {
      const last = members[members.length - 1]!;
      const next = events.slice(events.indexOf(last) + 1).find(e => e.lane === thread.lane && !e.thread);
      if (next) add(last.id, next.id, 'branch', `${thread.label} rejoins the main story`);
    }
  }
  return [...pairs.values()];
}
