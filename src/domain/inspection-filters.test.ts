import type { InspectionSummary } from '@/domain/inspection';
import {
  countActiveFilters,
  filterInspections,
  filtersForView,
  hasActiveFilters,
  NO_FILTERS,
  summarizeDay,
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

describe('countActiveFilters', () => {
  it('counts selected options, not the search', () => {
    expect(
      countActiveFilters({ ...NO_FILTERS, query: 'x', statuses: ['ASSIGNED'], unsentOnly: true })
    ).toBe(2);
  });
});

describe('summarizeDay', () => {
  it('counts each block with the filter it opens', () => {
    const list = [...LIST, inspection({ id: 'canceled-today', status: 'CANCELED' })];
    const overview = summarizeDay(list, NOW);

    expect(overview).toEqual({
      today: filterInspections(list, filtersForView('today'), NOW).length,
      overdue: 1,
      inProgress: 1,
      withUnsentWork: 1,
    });
    expect(overview.today).toBe(3);
  });

  it('keeps business status and sync state independent', () => {
    const both = [inspection({ status: 'IN_PROGRESS', syncState: 'aguardando-envio' })];

    expect(summarizeDay(both, NOW)).toMatchObject({ inProgress: 1, withUnsentWork: 1 });
  });

  it('counts failed and conflicting records as not sent', () => {
    const records = [
      inspection({ id: 'a', syncState: 'falha' }),
      inspection({ id: 'b', syncState: 'conflito' }),
      inspection({ id: 'c', syncState: 'enviado' }),
    ];

    expect(summarizeDay(records, NOW).withUnsentWork).toBe(2);
  });

  it('is all zeros for an empty device', () => {
    expect(summarizeDay([], NOW)).toEqual({
      today: 0,
      overdue: 0,
      inProgress: 0,
      withUnsentWork: 0,
    });
  });
});
