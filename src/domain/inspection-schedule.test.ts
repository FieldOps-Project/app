import type { InspectionSummary } from '@/domain/inspection';
import { isOverdue } from '@/domain/inspection-schedule';

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
