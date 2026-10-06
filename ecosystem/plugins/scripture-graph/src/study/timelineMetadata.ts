import type { TimelineEvent } from './timelineView';

export const eventThreadIds = (event: TimelineEvent): string[] =>
  [...new Set(event.thread_ids?.length ? event.thread_ids : event.thread ? [event.thread] : [])];

export function eventDate(event: TimelineEvent): string {
  if (event.date_label) return event.date_label;
  const year = (y: number) => y < 0 ? `${-y} BC` : `AD ${y}`;
  return event.y0 === event.y1 ? year(event.y0) : `${year(event.y0)} – ${year(event.y1)}`;
}

export const eventHasCalendarDate = (event: TimelineEvent): boolean =>
  event.date_precision !== 'undated' && event.date_precision !== 'relative';
