import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { OptionButton } from '@/design-system/components/option-button';
import { RESPONSE_TYPES, type ChecklistItem } from '@/domain/checklist';
import { responseFieldFor } from '@/features/checklist/components/response-fields';
import { ConformityField } from '@/features/checklist/components/response-fields/choice-fields';
import { UnsupportedField } from '@/features/checklist/components/response-fields/unsupported-field';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Icons load their font asynchronously; irrelevant here and noisy under act(). */
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
