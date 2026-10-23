import { act } from 'react';
import { FlatList } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import type { ChecklistItem } from '@/domain/checklist';
import { computeProgress } from '@/domain/checklist-progress';
import type { InspectionDetail } from '@/domain/inspection';
import { ChecklistItemRow } from '@/features/checklist/components/checklist-item-row';
import { UnsupportedField } from '@/features/checklist/components/response-fields/unsupported-field';
import { ChecklistScreen } from '@/features/checklist/screens/checklist-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Icons load their font asynchronously; irrelevant here and noisy under act(). */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockState: { current: InspectionDetailState } = { current: { state: 'loading' } };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

const TYPES = [
  'TEXT_SHORT',
  'TEXT_LONG',
  'NUMBER',
  'BOOLEAN',
  'CONFORMITY',
  'SINGLE_CHOICE',
  'DATE',
  'THERMAL_IMAGE',
];

const ITEMS: ChecklistItem[] = TYPES.map((responseType, index) => ({
  id: `item-${index}`,
  sectionTitle: index < 4 ? 'Identificação' : 'Condições',
  sectionDescription: null,
  sectionOrder: index < 4 ? 1 : 2,
  itemCode: null,
  itemTitle: `Item ${responseType}`,
  itemDescription: null,
  responseType,
  required: true,
  rules: {
    observationRequiredOnFailure: false,
    evidenceRequiredOnFailure: false,
    min: null,
    max: null,
  },
  options: responseType === 'SINGLE_CHOICE' ? ['Vazio', 'Cheio'] : [],
  itemOrder: index + 1,
}));

const DETAIL = {
  id: 'insp-1',
  status: 'IN_PROGRESS',
  review: null,
} as unknown as InspectionDetail;

function ready(status: InspectionDetail['status'] = 'IN_PROGRESS'): InspectionDetailState {
  const responses = new Map();
  const evidenceCounts = new Map();
  return {
    state: 'ready',
    detail: { ...DETAIL, status },
    items: ITEMS,
    responses,
    evidenceCounts,
    progress: computeProgress({ items: ITEMS, responses, evidenceCounts }),
  };
}

function render(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(<ChecklistScreen />);
  });
  return renderer!;
}

describe('ChecklistScreen', () => {
  it('builds the whole checklist from the snapshot, in order, behind a virtualized list', () => {
    mockState.current = ready();
    const renderer = render();

    const data = renderer.root.findByType(FlatList).props.data as {
      kind: string;
      key: string;
      item?: ChecklistItem;
    }[];
    expect(data.map((row) => row.key)).toEqual([
      'section-1',
      'item-0',
      'item-1',
      'item-2',
      'item-3',
      'section-2',
      'item-4',
      'item-5',
      'item-6',
      'item-7',
    ]);
    expect(renderer.root.findAllByType(ChecklistItemRow).length).toBeLessThan(ITEMS.length);
  });

  it('renders an unknown type as an incompatibility notice without breaking the row', () => {
    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(
        <ChecklistItemRow
          item={ITEMS[7]!}
          response={undefined}
          evidenceCount={0}
          needsObservation={false}
          needsEvidence={false}
          toCorrect={false}
          editable
          focused={false}
          onSave={jest.fn()}
          onCaptureEvidence={jest.fn()}
        />
      );
    });

    expect(renderer!.root.findAllByType(UnsupportedField)).toHaveLength(1);
  });

  it('locks every row once the inspection is completed (RN-043)', () => {
    mockState.current = ready('SUBMITTED');
    const renderer = render();

    const rows = renderer.root.findAllByType(ChecklistItemRow);
    expect(rows.every((row) => row.props.editable === false)).toBe(true);
  });
});
