import { act } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import { OptionButton } from '@/design-system/components/option-button';
import type { ChecklistItem } from '@/domain/checklist';
import type { InspectionDetail } from '@/domain/inspection';
import type { NonConformity } from '@/domain/non-conformity';
import { NonConformitiesScreen } from '@/features/non-conformities/screens/non-conformities-screen';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({ env: { appEnv: 'production' }, isDevelopment: false }));

const mockParams: { current: Record<string, string> } = { current: {} };
const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockReturn = jest.fn();
const mockDetail: { current: InspectionDetailState } = { current: { state: 'loading' } };
const mockList: { current: { isPending: boolean; isError: boolean; data: NonConformity[] } } = {
  current: { isPending: false, isError: false, data: [] },
};
const mockCreate = jest.fn();
const mockRemove = jest.fn();
const mockRemoveState: { current: Record<string, unknown> } = { current: {} };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, setParams: mockSetParams, back: jest.fn() }),
  useLocalSearchParams: () => ({ inspectionId: 'insp-1', ...mockParams.current }),
}));
jest.mock('@/features/checklist/hooks/use-return-to-checklist', () => ({
  useReturnToChecklist: () => mockReturn,
}));
jest.mock('@/application/inspections/use-inspection-detail', () => ({
  useInspectionDetail: () => mockDetail.current,
}));
jest.mock('@/application/non-conformities/use-non-conformities', () => ({
  useNonConformities: () => ({ ...mockList.current, refetch: jest.fn() }),
  useCreateNonConformity: () => ({
    mutate: mockCreate,
    reset: jest.fn(),
    isPending: false,
    error: null,
  }),
  useDeleteNonConformity: () => ({
    mutate: mockRemove,
    isPending: false,
    error: null,
    data: undefined,
    variables: undefined,
    ...mockRemoveState.current,
  }),
}));

const ITEM = {
  id: 'item-1',
  itemTitle: 'Proteção lateral',
  sectionTitle: 'Geral',
} as ChecklistItem;

function ready(status: InspectionDetail['status'] = 'IN_PROGRESS'): InspectionDetailState {
  return {
    state: 'ready',
    detail: { id: 'insp-1', title: 'Inspeção do gerador', status } as InspectionDetail,
    items: [ITEM],
    responses: new Map(),
    evidenceCounts: new Map(),
    evidences: {},
    progress: {} as never,
  };
}

function registered(overrides: Partial<NonConformity> = {}): NonConformity {
  return {
    id: 'nc-1',
    inspectionId: 'insp-1',
    inspectionItemId: 'item-1',
    itemTitle: 'Proteção lateral',
    title: 'Vazamento hidráulico',
    description: 'Óleo escorrendo pela base.',
    severity: 'HIGH',
    createdAtDevice: '2026-08-12T13:00:00.000Z',
    syncState: 'aguardando-envio',
    evidenceCount: 0,
    ...overrides,
  };
}

function press(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType(Button).find((entry) => entry.props.label === label);
  if (button === undefined) {
    throw new Error(`Sem botão "${label}"`);
  }
  act(() => button.props.onPress());
}

function labels(renderer: ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Button).map((button) => button.props.label);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  mockDetail.current = ready();
  mockList.current = { isPending: false, isError: false, data: [] };
  mockRemoveState.current = {};
});

describe('NonConformitiesScreen list', () => {
  it('says how to register the first one when there is none', () => {
    const text = renderedText(render(<NonConformitiesScreen />));

    expect(text).toContain('Nenhuma não conformidade registrada');
    expect(text).toContain('marque um item como não conforme');
  });

  it('states the criticidade in words, not only by color', () => {
    mockList.current.data = [registered({ severity: 'CRITICAL', evidenceCount: 1 })];

    expect(renderedText(render(<NonConformitiesScreen />))).toContain('Criticidade crítica');
  });

  it('shows the loading and the failure of the list', () => {
    mockList.current = { isPending: true, isError: false, data: [] };
    expect(renderedText(render(<NonConformitiesScreen />))).toContain('Carregando');

    mockList.current = { isPending: false, isError: true, data: [] };
    expect(renderedText(render(<NonConformitiesScreen />))).toContain(
      'Não foi possível ler as não conformidades'
    );
  });
});

describe('NonConformitiesScreen registration', () => {
  beforeEach(() => {
    mockParams.current = { itemId: 'item-1' };
  });

  it('opens the form already tied to the item it came from', () => {
    const renderer = render(<NonConformitiesScreen />);

    expect(renderedText(renderer)).toContain('Item: Proteção lateral');
    expect(renderer.root.findAllByType(Input).map((input) => input.props.label)).toEqual([
      'Título',
      'Descrição',
    ]);
    expect(renderer.root.findAllByType(OptionButton).map((option) => option.props.label)).toEqual([
      'Baixa',
      'Média',
      'Alta',
      'Crítica',
    ]);
  });

  it('asks for title, description and criticidade, and saves nothing until they are given', async () => {
    const renderer = render(<NonConformitiesScreen />);

    await act(async () => {
      press(renderer, 'Registrar não conformidade');
    });

    const text = renderedText(renderer);
    expect(text).toContain('Informe o título.');
    expect(text).toContain('Descreva o que foi encontrado.');
    expect(text).toContain('Escolha a criticidade.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('registers it with the item, the text and the chosen criticidade', async () => {
    const renderer = render(<NonConformitiesScreen />);
    const field = (label: string) =>
      renderer.root.findAllByType(Input).find((input) => input.props.label === label)!;

    await act(async () => {
      field('Título').props.onChangeText('  Vazamento hidráulico ');
      field('Descrição').props.onChangeText('Óleo escorrendo pela base.');
      renderer.root
        .findAllByType(OptionButton)
        .find((option) => option.props.label === 'Crítica')
        ?.props.onPress();
    });
    await act(async () => {
      press(renderer, 'Registrar não conformidade');
    });

    expect(mockCreate).toHaveBeenCalledWith(
      {
        inspectionItemId: 'item-1',
        form: {
          title: 'Vazamento hidráulico',
          description: 'Óleo escorrendo pela base.',
          severity: 'CRITICAL',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it('warns that a critical level needs evidence, without blocking the registration', () => {
    expect(renderedText(render(<NonConformitiesScreen />))).toContain(
      'exige ao menos uma foto de evidência antes de concluir'
    );
  });

  it('offers no form once the inspection is locked', () => {
    mockDetail.current = ready('SUBMITTED');

    const renderer = render(<NonConformitiesScreen />);

    expect(renderer.root.findAllByType(Input)).toHaveLength(0);
    expect(labels(renderer)).not.toContain('Registrar não conformidade');
  });
});

describe('NonConformitiesScreen evidence and deletion', () => {
  it('sends the technician to the camera with the non-conformity and its item', () => {
    mockList.current.data = [registered()];
    const renderer = render(<NonConformitiesScreen />);

    press(renderer, 'Fotografar evidência');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/evidence/capture',
      params: { inspectionId: 'insp-1', itemId: 'item-1', nonConformityId: 'nc-1' },
    });
  });

  it('shows what a critical registration still lacks, and what it has once photographed', () => {
    mockList.current.data = [
      registered({ id: 'a', severity: 'CRITICAL', evidenceCount: 0 }),
      registered({ id: 'b', severity: 'CRITICAL', evidenceCount: 2 }),
    ];

    const text = renderedText(render(<NonConformitiesScreen />));

    expect(text).toContain('Criticidade crítica exige ao menos uma evidência');
    expect(text).toContain('2 evidências registradas');
  });

  it('asks before deleting a pending registration and then deletes it', () => {
    mockList.current.data = [registered()];
    const renderer = render(<NonConformitiesScreen />);

    press(renderer, 'Excluir');
    expect(mockRemove).not.toHaveBeenCalled();
    expect(renderedText(renderer)).toContain('As fotos dela também serão removidas');

    press(renderer, 'Confirmar exclusão');
    expect(mockRemove).toHaveBeenCalledWith('nc-1');
  });

  it('keeps a sent registration, which can no longer be deleted (RN-056)', () => {
    mockList.current.data = [registered({ syncState: 'enviado' })];

    const renderer = render(<NonConformitiesScreen />);

    expect(labels(renderer)).not.toContain('Excluir');
    expect(renderedText(renderer)).toContain('não pode mais ser excluída');
  });

  it('says so when the server already has the one the technician tried to delete', () => {
    mockList.current.data = [registered()];
    mockRemoveState.current = { data: { outcome: 'already-sent' } };

    expect(renderedText(render(<NonConformitiesScreen />))).toContain('já foi enviada ao servidor');
  });
});
