import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Input } from '@/design-system/components/input';
import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import { computeProgress } from '@/domain/checklist-progress';
import type { InspectionDetail } from '@/domain/inspection';
import { ChecklistScreen } from '@/features/checklist/screens/checklist-screen';
import '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockState: { current: InspectionDetailState } = { current: { state: 'loading' } };
const mockFieldRenders: Record<string, number> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => ({ inspectionId: 'insp-1' }),
  useNavigation: () => ({ getState: () => ({ routes: [] }), addListener: () => () => undefined }),
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 56 }));
jest.mock('@/config/env', () => ({ env: { appEnv: 'production' }, isDevelopment: false }));
jest.mock('@/application/inspections/use-inspection-detail', () => ({
  useInspectionDetail: () => mockState.current,
}));
jest.mock('@/application/inspections/use-checklist-actions', () => ({
  useSaveAnswer: () => ({ save: jest.fn(), error: null, reset: jest.fn() }),
}));
jest.mock('@/application/inspection-draft/inspection-draft-context', () => ({
  useInspectionDraft: () => ({ focusedItemFor: () => null, focusItem: jest.fn() }),
}));
jest.mock('@/features/checklist/components/response-fields', () => ({
  responseFieldFor: () =>
    function CountedField({ item }: { item: ChecklistItem }) {
      mockFieldRenders[item.id] = (mockFieldRenders[item.id] ?? 0) + 1;
      return null;
    },
}));

const ITEM_COUNT = 100;

const ITEMS: ChecklistItem[] = Array.from({ length: ITEM_COUNT }, (_, index) => ({
  id: `item-${index}`,
  sectionTitle: 'Geral',
  sectionDescription: null,
  sectionOrder: 1,
  itemCode: null,
  itemTitle: `Item ${index}`,
  itemDescription: null,
  responseType: 'TEXT_SHORT',
  required: true,
  rules: {
    observationRequiredOnFailure: false,
    evidenceRequiredOnFailure: false,
    min: null,
    max: null,
  },
  options: [],
  itemOrder: index + 1,
}));

const DETAIL = { id: 'insp-1', status: 'IN_PROGRESS', review: null } as unknown as InspectionDetail;

function answer(itemId: string): ChecklistResponse {
  return {
    id: `resp-${itemId}`,
    inspectionItemId: itemId,
    valueText: 'ok',
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: null,
    observation: null,
    answeredAtDevice: '2026-08-12T10:00:00Z',
  };
}

function ready(answered: ChecklistResponse[]): InspectionDetailState {
  const responses = new Map(answered.map((response) => [response.inspectionItemId, response]));
  const evidenceCounts = new Map();
  return {
    state: 'ready',
    detail: DETAIL,
    items: ITEMS,
    evidences: {},
    responses,
    evidenceCounts,
    progress: computeProgress({ items: ITEMS, responses, evidenceCounts }),
  };
}

let mounted: ReactTestRenderer | null = null;

async function renderSettled(): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(<ChecklistScreen />);
  });
  if (renderer === undefined) {
    throw new Error('A renderização não produziu uma árvore.');
  }
  mounted = renderer;
  return renderer;
}

function renderedItems(): string[] {
  return Object.keys(mockFieldRenders).sort();
}

function snapshotRenders(): Record<string, number> {
  return { ...mockFieldRenders };
}

function observationOf(renderer: ReactTestRenderer, itemId: string) {
  const index = ITEMS.findIndex((item) => item.id === itemId);
  const inputs = renderer.root
    .findAllByType(Input)
    .filter((input) => input.props.label.startsWith('Observação'));
  const found = inputs[index];
  if (found === undefined) {
    throw new Error(`Observação do ${itemId} não renderizada.`);
  }
  return found;
}

afterEach(async () => {
  const screen = mounted;
  mounted = null;
  await act(async () => screen?.unmount());
});

beforeEach(() => {
  for (const key of Object.keys(mockFieldRenders)) {
    delete mockFieldRenders[key];
  }
});

describe('checklist rendering cost', () => {
  it('renders only a window of a 100-item checklist', async () => {
    mockState.current = ready([]);

    await renderSettled();

    expect(renderedItems().length).toBeGreaterThan(0);
    expect(renderedItems().length).toBeLessThan(ITEM_COUNT / 4);
  });

  it('does not re-render the neighbours while typing in one item', async () => {
    mockState.current = ready([]);
    const renderer = await renderSettled();
    const before = snapshotRenders();

    await act(async () => {
      observationOf(renderer, 'item-1').props.onChangeText('Vazamento na junta');
    });

    const after = snapshotRenders();
    const changed = Object.keys(after).filter((id) => after[id] !== before[id]);
    expect(changed).toEqual(['item-1']);
  });

  it('re-renders only the item whose answer changed once it is saved', async () => {
    mockState.current = ready([]);
    const renderer = await renderSettled();
    const before = snapshotRenders();

    mockState.current = ready([answer('item-1')]);
    await act(async () => {
      renderer.update(<ChecklistScreen />);
    });

    const after = snapshotRenders();
    const changed = Object.keys(after).filter((id) => after[id] !== before[id]);
    expect(changed).toEqual(['item-1']);
  });
});
