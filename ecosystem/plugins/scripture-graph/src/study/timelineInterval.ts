import type { TimelineEvent } from './timelineView';
import { eventHasCalendarDate } from './timelineMetadata';

/** Calendar years between listed starts; the BC/AD calendar has no year zero. */
export function timelineInterval(a: TimelineEvent, b: TimelineEvent): { years: number | null; label: string } {
  if (!eventHasCalendarDate(a) || !eventHasCalendarDate(b)) return { years: null, label: 'Interval not specified in the text' };
  const crossesEra = (a.y0 < 0 && b.y0 > 0) || (b.y0 < 0 && a.y0 > 0);
  const years = Math.max(0, Math.abs(b.y0 - a.y0) - (crossesEra ? 1 : 0));
  const approximate = [a, b].some(e => e.dating === 'traditional' || e.dating === 'approximate');
  return { years, label: years === 0 ? 'Same starting year'
    : `${approximate ? 'About ' : ''}${years.toLocaleString()} year${years === 1 ? '' : 's'} apart` };
}
