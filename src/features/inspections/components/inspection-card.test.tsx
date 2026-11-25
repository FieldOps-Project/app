import { act } from 'react';
import { create } from 'react-test-renderer';

import type { InspectionSummary } from '@/domain/inspection';
import { InspectionCard } from '@/features/inspections/components/inspection-card';
import { renderedText } from '@/testing/render';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function summary(status: InspectionSummary['status']): InspectionSummary {
  return {
    id: 'insp-1',
    title: 'Inspeção do gerador',
    status,
    priority: 'MEDIUM',
    scheduledFor: '2026-08-12T13:00:00Z',
    clientName: 'Indústria ABC',
    siteName: 'Fábrica',
    equipmentName: null,
    syncState: 'enviado',
  };
}

function textOf(status: InspectionSummary['status']): string {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(<InspectionCard inspection={summary(status)} overdue={false} />);
  });
  return renderedText(renderer!);
}

describe('InspectionCard (card #30)', () => {
  it('highlights a rejected inspection as requiring correction', () => {
    expect(textOf('REJECTED')).toContain('Requer correção');
  });

  it.each(['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'] as const)(
    'does not highlight an inspection that is %s',
    (status) => {
      expect(textOf(status)).not.toContain('Requer correção');
    }
  );
});
