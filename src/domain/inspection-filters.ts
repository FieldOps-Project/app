import type { InspectionPriority, InspectionStatus, InspectionSummary } from '@/domain/inspection';
import {
  hasUnsentWork,
  isOverdue,
  isScheduledToday,
  type InspectionView,
} from '@/domain/inspection-schedule';

export type DateRange = 'all' | 'today' | 'overdue' | 'next-7-days';

/**
 * What the technician narrowed the list to. Every field combines with the
 * others (AC of card #10), and an empty set means "any".
 */
export interface InspectionFilters {
  readonly query: string;
  readonly statuses: readonly InspectionStatus[];
  readonly priorities: readonly InspectionPriority[];
  readonly dateRange: DateRange;
  readonly unsentOnly: boolean;
}

export const NO_FILTERS: InspectionFilters = {
  query: '',
  statuses: [],
  priorities: [],
  dateRange: 'all',
  unsentOnly: false,
};

/** The filters a home block opens the list with (card #9). */
export function filtersForView(view: InspectionView | null): InspectionFilters {
  switch (view) {
    case 'today':
      return { ...NO_FILTERS, dateRange: 'today' };
    case 'overdue':
      return { ...NO_FILTERS, dateRange: 'overdue' };
    case 'in-progress':
      return { ...NO_FILTERS, statuses: ['IN_PROGRESS'] };
    case 'pending-sync':
      return { ...NO_FILTERS, unsentOnly: true };
    case null:
      return NO_FILTERS;
  }
}

export function hasActiveFilters(filters: InspectionFilters): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dateRange !== 'all' ||
    filters.unsentOnly
  );
}

/** Case- and accent-insensitive, so "sao jorge" finds "São Jorge". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const DAY_MS = 24 * 60 * 60 * 1000;

function inDateRange(inspection: InspectionSummary, range: DateRange, now: Date): boolean {
  switch (range) {
    case 'all':
      return true;
    case 'today':
      return isScheduledToday(inspection, now);
    case 'overdue':
      return isOverdue(inspection, now);
    case 'next-7-days': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const scheduled = new Date(inspection.scheduledFor).getTime();
      return scheduled >= start.getTime() && scheduled < start.getTime() + 7 * DAY_MS;
    }
  }
}

/**
 * A view over the collection: returns a new array and never touches the
 * source, so filtering can never remove anything stored on the device
 * (AC-MOBILE-LIST). Runs without network — the search is local.
 */
export function filterInspections(
  inspections: readonly InspectionSummary[],
  filters: InspectionFilters,
  now: Date
): readonly InspectionSummary[] {
  const term = normalize(filters.query);

  return inspections.filter(
    (inspection) =>
      (filters.statuses.length === 0 || filters.statuses.includes(inspection.status)) &&
      (filters.priorities.length === 0 || filters.priorities.includes(inspection.priority)) &&
      inDateRange(inspection, filters.dateRange, now) &&
      (!filters.unsentOnly || hasUnsentWork(inspection)) &&
      (term === '' ||
        [inspection.title, inspection.clientName, inspection.siteName, inspection.equipmentName]
          .filter((field): field is string => field !== null)
          .some((field) => normalize(field).includes(term)))
  );
}

export function dateRangeLabel(range: DateRange): string {
  const labels: Record<DateRange, string> = {
    all: 'Qualquer data',
    today: 'Hoje',
    overdue: 'Atrasadas',
    'next-7-days': 'Próximos 7 dias',
  };
  return labels[range];
}
