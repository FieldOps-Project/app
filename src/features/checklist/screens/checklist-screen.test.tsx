import { act } from 'react';
import { FlatList } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import type { ChecklistItem } from '@/domain/checklist';
import { computeProgress } from '@/domain/checklist-progress';
import { syncStateLabel, type InspectionDetail } from '@/domain/inspection';
import { ChecklistItemRow } from '@/features/checklist/components/checklist-item-row';
import { UnsupportedField } from '@/features/checklist/components/response-fields/unsupported-field';
import { renderedText } from '@/testing/render';
import { ChecklistScreen } from '@/features/checklist/screens/checklist-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
jest.mock('@/application/non-conformities/use-non-conformities', () => ({
  useNonConformities: () => ({ data: [] }),
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
  syncState: 'salvo-no-dispositivo',
  review: null,
} as unknown as InspectionDetail;

function ready(
  status: InspectionDetail['status'] = 'IN_PROGRESS',
  syncState: InspectionDetail['syncState'] = 'salvo-no-dispositivo'
): InspectionDetailState {
  const responses = new Map();
  const evidenceCounts = new Map();
  return {
    state: 'ready',
    detail: { ...DETAIL, status, syncState },
    items: ITEMS,
    evidences: {},
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

function rowFor(options: {
  conformity: 'CONFORMING' | 'NON_CONFORMING';
  nonConformityCount?: number;
  editable?: boolean;
  onRegister?: () => void;
}): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <ChecklistItemRow
        item={ITEMS[4]!}
        response={{
          id: 'resp-1',
          inspectionItemId: ITEMS[4]!.id,
          valueText: null,
          valueNumber: null,
          valueBoolean: null,
          valueDate: null,
          conformity: options.conformity,
          observation: null,
          answeredAtDevice: '2026-08-12T10:00:00Z',
        }}
        evidences={[]}
        needsObservation={false}
        needsEvidence={false}
        toCorrect={false}
        editable={options.editable ?? true}
        focused={false}
        nonConformityCount={options.nonConformityCount ?? 0}
        onSave={jest.fn()}
        onCaptureEvidence={jest.fn()}
        onRegisterNonConformity={options.onRegister ?? jest.fn()}
        onOpenEvidence={jest.fn()}
      />
    );
  });
  return renderer!;
}

function registerButtons(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType(Button)
    .filter((button) => String(button.props.label).includes('não conformidade'));
}

describe('suggesting a non-conformity', () => {
  it('suggests the registration for a non-conforming answer, without forcing it', () => {
    const onRegister = jest.fn();
    const renderer = rowFor({ conformity: 'NON_CONFORMING', onRegister });

    const [button] = registerButtons(renderer);
    expect(button?.props.label).toBe('Registrar não conformidade');
    act(() => button?.props.onPress());

    expect(onRegister).toHaveBeenCalledWith(ITEMS[4]!.id);
    expect(
      renderer.root.findAllByType(Button).every((entry) => entry.props.disabled !== true)
    ).toBe(true);
  });

  it('says how many were registered and offers another one', () => {
    const renderer = rowFor({ conformity: 'NON_CONFORMING', nonConformityCount: 2 });

    expect(registerButtons(renderer)[0]?.props.label).toBe('Registrar outra não conformidade');
    expect(JSON.stringify(renderer.toJSON())).toContain('2 não conformidades registradas');
  });

  it('stays quiet for a conforming answer and for a locked inspection', () => {
    expect(registerButtons(rowFor({ conformity: 'CONFORMING' }))).toHaveLength(0);
    expect(registerButtons(rowFor({ conformity: 'NON_CONFORMING', editable: false }))).toHaveLength(
      0
    );
  });
});

describe('ChecklistScreen save status', () => {
  it.each([
    ['salvo-no-dispositivo', 'Cada resposta é salva neste aparelho na hora.'],
    ['aguardando-envio', 'Tudo o que você respondeu está salvo neste aparelho.'],
    ['falha', 'Tudo o que você respondeu está salvo neste aparelho.'],
    ['enviado', 'Tudo o que você respondeu foi enviado e está salvo neste aparelho.'],
  ] as const)('keeps saying where the work is while the inspection is %s', (syncState, caption) => {
    mockState.current = ready('IN_PROGRESS', syncState);

    const text = renderedText(render());

    expect(text).toContain(caption);
    expect(text).toContain(syncStateLabel(syncState));
  });
});

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
          evidences={[]}
          needsObservation={false}
          needsEvidence={false}
          toCorrect={false}
          editable
          focused={false}
          nonConformityCount={0}
          onSave={jest.fn()}
          onCaptureEvidence={jest.fn()}
          onRegisterNonConformity={jest.fn()}
          onOpenEvidence={jest.fn()}
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
