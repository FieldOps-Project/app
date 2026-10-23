import type { InspectionSummary } from '@/domain/inspection';
import { isOverdue, matchesView, summarizeDay } from '@/domain/inspection-schedule';

const NOW = new Date(2026, 7, 12, 15, 0);

function at(day: number, hour: number): string {
  return new Date(2026, 7, day, hour, 0).toISOString();
}

function inspection(overrides: Partial<InspectionSummary>): InspectionSummary {
  return {
    id: 'insp',
    title: 'Inspeção',
    status: 'ASSIGNED',
    priority: 'MEDIUM',
    scheduledFor: at(12, 9),
    clientName: 'Cliente',
    siteName: 'Local',
    equipmentName: null,
    syncState: 'salvo-no-dispositivo',
    ...overrides,
  };
}

describe('isOverdue', () => {
  it('is an open inspection whose scheduled day is over', () => {
    expect(isOverdue(inspection({ scheduledFor: at(11, 9) }), NOW)).toBe(true);
    expect(isOverdue(inspection({ scheduledFor: at(11, 9), status: 'IN_PROGRESS' }), NOW)).toBe(
      true
    );
  });

  it('is never a same-day inspection, nor a finished or canceled one', () => {
    expect(isOverdue(inspection({ scheduledFor: at(12, 9) }), NOW)).toBe(false);
    expect(isOverdue(inspection({ scheduledFor: at(11, 9), status: 'SUBMITTED' }), NOW)).toBe(
      false
    );
    expect(isOverdue(inspection({ scheduledFor: at(11, 9), status: 'CANCELED' }), NOW)).toBe(false);
  });
});

describe('matchesView', () => {
  it('keeps business status and sync state independent', () => {
    const both = inspection({ status: 'IN_PROGRESS', syncState: 'aguardando-envio' });

    expect(matchesView(both, 'in-progress', NOW)).toBe(true);
    expect(matchesView(both, 'pending-sync', NOW)).toBe(true);
  });

  it('counts failed and conflicting records as not sent', () => {
    expect(matchesView(inspection({ syncState: 'falha' }), 'pending-sync', NOW)).toBe(true);
    expect(matchesView(inspection({ syncState: 'conflito' }), 'pending-sync', NOW)).toBe(true);
    expect(matchesView(inspection({ syncState: 'enviado' }), 'pending-sync', NOW)).toBe(false);
  });
});

describe('summarizeDay', () => {
  it('counts each block of the home screen', () => {
    const overview = summarizeDay(
      [
        inspection({ id: 'a' }),
        inspection({ id: 'b', status: 'IN_PROGRESS', syncState: 'aguardando-envio' }),
        inspection({ id: 'c', scheduledFor: at(10, 8) }),
        inspection({ id: 'd', scheduledFor: at(12, 10), status: 'CANCELED' }),
        inspection({ id: 'e', scheduledFor: at(14, 10) }),
      ],
      NOW
    );

    expect(overview).toEqual({ today: 2, overdue: 1, inProgress: 1, withUnsentWork: 1 });
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
