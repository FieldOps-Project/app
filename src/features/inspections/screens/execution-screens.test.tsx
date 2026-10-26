import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import { computeProgress } from '@/domain/checklist-progress';
import type { InspectionDetail } from '@/domain/inspection';
import { InspectionStartScreen } from '@/features/inspections/screens/inspection-start-screen';
import { InspectionSummaryScreen } from '@/features/inspections/screens/inspection-summary-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Icons load their font asynchronously; irrelevant here and noisy under act(). */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockState: { current: InspectionDetailState } = { current: { state: 'loading' } };
const mockStart = jest.fn();
const mockComplete = jest.fn();
const mockStartState: { current: Record<string, unknown> } = { current: {} };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({ inspectionId: 'insp-1' }),
}));
jest.mock('@/application/inspections/use-inspection-detail', () => ({
  useInspectionDetail: () => mockState.current,
}));
jest.mock('@/application/inspections/use-execution-actions', () => ({
  useStartInspection: () => ({
    mutate: mockStart,
    isPending: false,
    error: null,
    ...mockStartState.current,
  }),
  useCompleteInspection: () => ({
    mutate: mockComplete,
    reset: jest.fn(),
    isPending: false,
    error: null,
  }),
}));
jest.mock('@/application/inspection-draft/inspection-draft-context', () => ({
  useInspectionDraft: () => ({ focusedItemFor: () => null, focusItem: jest.fn() }),
}));
jest.mock('@/features/checklist/hooks/use-return-to-checklist', () => ({
  useReturnToChecklist: () => jest.fn(),
  useReturnToChecklistItem: () => jest.fn(),
}));
jest.mock('@/application/location/use-location-permission', () => ({
  useLocationPermission: () => 'undetermined',
}));
jest.mock('@/features/synchronization/components/sync-now-button', () => ({
  SyncNowButton: () => null,
}));

const ITEM: ChecklistItem = {
  id: 'item-1',
  sectionTitle: 'Geral',
  sectionDescription: null,
  sectionOrder: 1,
  itemCode: null,
  itemTitle: 'Proteção lateral',
  itemDescription: null,
  responseType: 'CONFORMITY',
  required: true,
  rules: {
    observationRequiredOnFailure: false,
    evidenceRequiredOnFailure: false,
    min: null,
    max: null,
  },
  options: [],
  itemOrder: 1,
};

const ANSWER: ChecklistResponse = {
  id: 'r-1',
  inspectionItemId: 'item-1',
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  conformity: 'CONFORMING',
  observation: null,
  answeredAtDevice: '2026-08-12T10:00:00Z',
};

function ready(
  detail: Partial<InspectionDetail>,
  responses: ChecklistResponse[] = []
): InspectionDetailState {
  const byItem = new Map(responses.map((response) => [response.inspectionItemId, response]));
  const evidenceCounts = new Map<string, number>();
  return {
    state: 'ready',
    detail: {
      id: 'insp-1',
      title: 'Inspeção do gerador',
      status: 'IN_PROGRESS',
      syncState: 'aguardando-envio',
      clientName: 'Indústria ABC',
      client: { id: 'c', name: 'Indústria ABC' },
      site: { id: 's', name: 'Fábrica', addressLine: null, latitude: null, longitude: null },
      equipment: null,
      scheduledFor: '2026-08-12T13:00:00Z',
      completedAtDevice: null,
      startLocation: { status: 'not-recorded' },
      completionLocation: { status: 'not-recorded' },
      ...detail,
    } as InspectionDetail,
    items: [ITEM],
    responses: byItem,
    evidenceCounts,
    progress: computeProgress({ items: [ITEM], responses: byItem, evidenceCounts }),
  };
}

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
}

function buttonLabels(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Button).map((button) => button.props.label);
}

function texts(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStartState.current = {};
});

describe('InspectionStartScreen', () => {
  it('starts an assigned inspection after an explicit confirmation', () => {
    mockState.current = ready({ status: 'ASSIGNED' });
    const renderer = render(<InspectionStartScreen />);

    const confirm = renderer.root
      .findAllByType(Button)
      .find((button) => button.props.label === 'Confirmar início');
    act(() => confirm?.props.onPress());

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(texts(renderer)).toContain('o aparelho pede permissão');
    expect(texts(renderer)).toContain('Não há rastreamento contínuo');
  });

  it('says when the start was recorded without a position (card #19)', () => {
    mockState.current = ready({ status: 'IN_PROGRESS' });
    mockStartState.current = {
      isSuccess: true,
      data: { status: 'missing', reason: 'PERMISSION_DENIED' },
    };
    const renderer = render(<InspectionStartScreen />);

    expect(texts(renderer)).toContain('a permissão de localização foi negada');
    expect(buttonLabels(renderer)).toContain('Continuar para o checklist');
  });

  it('refuses a canceled inspection with the reason (RN-077)', () => {
    mockState.current = ready({ status: 'CANCELED' });
    const renderer = render(<InspectionStartScreen />);

    expect(buttonLabels(renderer)).not.toContain('Confirmar início');
    expect(texts(renderer)).toContain('foi cancelada e não pode ser iniciada');
  });
});

describe('InspectionSummaryScreen', () => {
  it('blocks the completion while something is pending', () => {
    mockState.current = ready({});
    const renderer = render(<InspectionSummaryScreen />);

    expect(buttonLabels(renderer)).not.toContain('Concluir inspeção');
    expect(texts(renderer)).toContain('Conclusão bloqueada');
  });

  it('asks for confirmation and says that completing is not sending', () => {
    mockState.current = ready({}, [ANSWER]);
    const renderer = render(<InspectionSummaryScreen />);

    expect(texts(renderer)).toContain('Concluir não é enviar');
    const conclude = renderer.root
      .findAllByType(Button)
      .find((button) => button.props.label === 'Concluir inspeção');
    act(() => conclude?.props.onPress());
    expect(mockComplete).not.toHaveBeenCalled();

    const confirm = renderer.root
      .findAllByType(Button)
      .find((button) => button.props.label === 'Confirmar conclusão');
    act(() => confirm?.props.onPress());
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('shows a completed inspection as waiting to be sent', () => {
    mockState.current = ready(
      {
        status: 'SUBMITTED',
        startedAtDevice: '2026-08-12T10:00:00Z',
        completedAtDevice: '2026-08-12T11:00:00Z',
        startLocation: {
          status: 'captured',
          position: {
            latitude: -23.5,
            longitude: -47.4,
            accuracy: 9,
            capturedAt: '2026-08-12T10:00:00Z',
          },
        },
        completionLocation: { status: 'missing', reason: 'TIMEOUT' },
      },
      [ANSWER]
    );
    const renderer = render(<InspectionSummaryScreen />);

    expect(texts(renderer)).toContain('ainda não foi enviada');
    expect(texts(renderer)).toContain('-23.50000, -47.40000');
    expect(texts(renderer)).toContain('o aparelho não encontrou a posição a tempo');
    expect(buttonLabels(renderer)).not.toContain('Concluir inspeção');
  });
});
