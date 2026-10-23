import type { InspectionSummary } from '@/domain/inspection';
import {
  filterInspections,
  filtersForView,
  hasActiveFilters,
  NO_FILTERS,
} from '@/domain/inspection-filters';

const NOW = new Date(2026, 7, 12, 15, 0);

function at(day: number, hour: number): string {
  return new Date(2026, 7, day, hour, 0).toISOString();
}

function inspection(overrides: Partial<InspectionSummary>): InspectionSummary {
  return {
    id: 'insp',
    title: 'Inspeção preventiva',
    status: 'ASSIGNED',
    priority: 'MEDIUM',
    scheduledFor: at(12, 9),
    clientName: 'Mercado São Jorge',
    siteName: 'Loja Centro',
    equipmentName: 'Gerador GD-001',
    syncState: 'salvo-no-dispositivo',
    ...overrides,
  };
}

const LIST = [
  inspection({ id: 'today-high', priority: 'HIGH' }),
  inspection({ id: 'late', scheduledFor: at(10, 9), clientName: 'Padaria Aurora' }),
  inspection({ id: 'running', status: 'IN_PROGRESS', syncState: 'aguardando-envio' }),
  inspection({ id: 'next-week', scheduledFor: at(17, 9), equipmentName: null }),
  inspection({ id: 'far', scheduledFor: at(30, 9) }),
];

function ids(list: readonly InspectionSummary[]) {
  return list.map((item) => item.id);
}

describe('filterInspections', () => {
  it('searches client, site and equipment, ignoring case and accents', () => {
    expect(ids(filterInspections(LIST, { ...NO_FILTERS, query: 'aurora' }, NOW))).toEqual(['late']);
    expect(ids(filterInspections(LIST, { ...NO_FILTERS, query: 'SAO JORGE' }, NOW))).toHaveLength(
      4
    );
    expect(ids(filterInspections(LIST, { ...NO_FILTERS, query: 'gd-001' }, NOW))).not.toContain(
      'next-week'
    );
  });

  it('combines status, priority and date', () => {
    const filtered = filterInspections(
      LIST,
      { ...NO_FILTERS, statuses: ['ASSIGNED'], priorities: ['HIGH'], dateRange: 'today' },
      NOW
    );
    expect(ids(filtered)).toEqual(['today-high']);
  });

  it('limits the next 7 days to the week ahead, today included', () => {
    expect(ids(filterInspections(LIST, { ...NO_FILTERS, dateRange: 'next-7-days' }, NOW))).toEqual([
      'today-high',
      'running',
      'next-week',
    ]);
  });

  it('never changes the collection it filters', () => {
    const source = [...LIST];
    filterInspections(source, { ...NO_FILTERS, query: 'nada' }, NOW);
    expect(source).toEqual(LIST);
  });
});

describe('filtersForView', () => {
  it('opens each home block with its filter', () => {
    expect(ids(filterInspections(LIST, filtersForView('overdue'), NOW))).toEqual(['late']);
    expect(ids(filterInspections(LIST, filtersForView('in-progress'), NOW))).toEqual(['running']);
    expect(ids(filterInspections(LIST, filtersForView('pending-sync'), NOW))).toEqual(['running']);
    expect(filtersForView(null)).toBe(NO_FILTERS);
  });
});

describe('hasActiveFilters', () => {
  it('ignores a blank search', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, query: '   ' })).toBe(false);
    expect(hasActiveFilters(filtersForView('today'))).toBe(true);
  });
});
