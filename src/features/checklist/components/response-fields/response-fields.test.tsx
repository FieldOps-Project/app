import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { OptionButton } from '@/design-system/components/option-button';
import { RESPONSE_TYPES, type ChecklistItem, type ResponseType } from '@/domain/checklist';
import { responseFieldFor } from '@/features/checklist/components/response-fields';
import { ConformityField } from '@/features/checklist/components/response-fields/choice-fields';
import { TEXT_LONG_MAX, TEXT_SHORT_MAX } from '@/schemas/checklist-response';
import { UnsupportedField } from '@/features/checklist/components/response-fields/unsupported-field';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const ITEM: ChecklistItem = {
  id: 'item',
  sectionTitle: 'Geral',
  sectionDescription: null,
  sectionOrder: 1,
  itemCode: null,
  itemTitle: 'Proteção lateral íntegra',
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

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
}

function options(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType(OptionButton);
}

describe('responseFieldFor', () => {
  it('maps each of the seven MVP types to its own component', () => {
    const components = RESPONSE_TYPES.map(responseFieldFor);

    expect(components).not.toContain(UnsupportedField);
    expect(new Set(components).size).toBe(RESPONSE_TYPES.length);
  });

  it('falls back to the incompatibility notice for an unknown type', () => {
    expect(responseFieldFor('THERMAL_IMAGE')).toBe(UnsupportedField);
  });
});

function drawField(responseType: string, overrides: Partial<ChecklistItem> = {}) {
  const item = { ...ITEM, responseType, ...overrides };
  const Field = responseFieldFor(responseType);
  const renderer = render(
    <Field item={item} value={null} onChange={jest.fn()} onCommit={jest.fn()} disabled={false} />
  );
  return renderer;
}

function draw(responseType: string, overrides: Partial<ChecklistItem> = {}): string {
  return JSON.stringify(drawField(responseType, overrides).toJSON());
}

describe('rendering of each item type', () => {
  const EXPECTED: Record<ResponseType, string[]> = {
    TEXT_SHORT: ['Resposta', `0 de ${TEXT_SHORT_MAX} caracteres`],
    TEXT_LONG: ['Resposta', `0 de ${TEXT_LONG_MAX} caracteres`],
    NUMBER: ['Resposta', 'Use vírgula para decimais.'],
    BOOLEAN: ['Sim', 'Não'],
    CONFORMITY: ['Conforme', 'Não conforme', 'Não aplicável'],
    SINGLE_CHOICE: ['Aço', 'Alumínio'],
    DATE: ['Nenhuma data escolhida', 'Escolher data'],
  };

  it.each(RESPONSE_TYPES)('shows the answer controls of %s', (responseType) => {
    const drawn = draw(responseType, { options: ['Aço', 'Alumínio'] });

    for (const text of EXPECTED[responseType]) {
      expect(drawn).toContain(text);
    }
    expect(drawn).not.toContain('incompatível');
  });

  it('shows the range of a number item', () => {
    expect(draw('NUMBER', { rules: { ...ITEM.rules, min: 2, max: 10 } })).toContain(
      'Entre 2 e 10.'
    );
  });

  it('shows one choice per option of a single-choice item', () => {
    const renderer = drawField('SINGLE_CHOICE', { options: ['A', 'B', 'C'] });

    expect(options(renderer).map((option) => option.props.label)).toEqual(['A', 'B', 'C']);
  });

  it('tells a required unknown type apart from an optional one', () => {
    expect(draw('THERMAL_IMAGE', { required: true })).toContain('obrigatório');
    expect(draw('THERMAL_IMAGE', { required: false })).toContain('Ele não impede a conclusão');
  });
});

describe('ConformityField', () => {
  it('comes with no option selected', () => {
    const renderer = render(
      <ConformityField
        item={ITEM}
        value={null}
        onChange={jest.fn()}
        onCommit={jest.fn()}
        disabled={false}
      />
    );

    const states = options(renderer).map((option) => option.props.selected);
    expect(states).toEqual([false, false, false]);
  });

  it('sets the value and commits on the tap itself', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    const renderer = render(
      <ConformityField
        item={ITEM}
        value={null}
        onChange={onChange}
        onCommit={onCommit}
        disabled={false}
      />
    );

    const notConforming = options(renderer).find((option) => option.props.label === 'Não conforme');
    act(() => notConforming?.props.onPress());

    expect(onChange).toHaveBeenCalledWith('NON_CONFORMING');
    expect(onCommit).toHaveBeenCalled();
  });
});
