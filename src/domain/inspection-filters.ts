import type { InspectionPriority, InspectionStatus, InspectionSummary } from '@/domain/inspection';
import {
  hasUnsentWork,
  isOverdue,
  isScheduledToday,
  startOfDay,
  type DayOverview,
  type InspectionView,
} from '@/domain/inspection-schedule';

export type DateRange = 'all' | 'today' | 'overdue' | 'next-7-days';

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

export function countActiveFilters(filters: InspectionFilters): number {
  return (
    filters.statuses.length +
    filters.priorities.length +
    (filters.dateRange === 'all' ? 0 : 1) +
    (filters.unsentOnly ? 1 : 0)
  );
}

export function hasActiveFilters(filters: InspectionFilters): boolean {
  return filters.query.trim() !== '' || countActiveFilters(filters) > 0;
}

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
      const start = startOfDay(now).getTime();
      const scheduled = new Date(inspection.scheduledFor).getTime();
      return scheduled >= start && scheduled < start + 7 * DAY_MS;
    }
  }
}

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

export function summarizeDay(inspections: readonly InspectionSummary[], now: Date): DayOverview {
  const count = (view: InspectionView) =>
    filterInspections(inspections, filtersForView(view), now).length;

  return {
    today: count('today'),
    overdue: count('overdue'),
    inProgress: count('in-progress'),
    withUnsentWork: count('pending-sync'),
  };
}
