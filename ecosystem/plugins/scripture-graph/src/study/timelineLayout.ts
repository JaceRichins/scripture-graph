import type { TimelineEvent } from './timelineView';
import { eventHasCalendarDate } from './timelineMetadata';

/** Align independent columns within a year; never overlap cards in a column.
 * Unknown dates retain narrative order instead of asserting simultaneity. */
export function timelineRows(events: TimelineEvent[], memberships: number[][]): number[] {
  let base = 0, bandEnd = 0, previous: string | null = null;
  let next = new Map<number, number>();
  return events.map((event, i) => {
    const band = eventHasCalendarDate(event) ? String(event.y0) : event.id;
    if (band !== previous) { base = bandEnd; next = new Map(); previous = band; }
    const columns = memberships[i] ?? [];
    const row = Math.max(base, ...columns.map(c => next.get(c) ?? base));
    for (const c of columns) next.set(c, row + 1);
    bandEnd = Math.max(bandEnd, row + 1);
    return row;
  });
}
