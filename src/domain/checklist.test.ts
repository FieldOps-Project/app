import {
  hasAnswer,
  isFailure,
  isKnownResponseType,
  toSections,
  type ChecklistItem,
  type ChecklistResponse,
} from '@/domain/checklist';

export function checklistItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item',
    sectionTitle: 'Geral',
    sectionDescription: null,
    sectionOrder: 1,
    itemCode: null,
    itemTitle: 'Item',
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
    ...overrides,
  };
}

function response(overrides: Partial<ChecklistResponse> = {}): ChecklistResponse {
  return {
    id: 'resp',
    inspectionItemId: 'item',
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: null,
    observation: null,
    answeredAtDevice: '2026-08-12T10:00:00Z',
    ...overrides,
  };
}

describe('toSections', () => {
  it('follows sectionOrder and then itemOrder from the snapshot', () => {
    const sections = toSections([
      checklistItem({ id: 'b2', sectionOrder: 2, sectionTitle: 'B', itemOrder: 2 }),
      checklistItem({ id: 'a1', sectionOrder: 1, sectionTitle: 'A', itemOrder: 1 }),
      checklistItem({ id: 'b1', sectionOrder: 2, sectionTitle: 'B', itemOrder: 1 }),
    ]);

    expect(sections.map((section) => section.title)).toEqual(['A', 'B']);
    expect(sections[1]?.items.map((item) => item.id)).toEqual(['b1', 'b2']);
  });
});

describe('hasAnswer', () => {
  it('reads the column of the item type', () => {
    expect(hasAnswer(checklistItem({ responseType: 'NUMBER' }), response({ valueNumber: 0 }))).toBe(
      true
    );
    expect(
      hasAnswer(checklistItem({ responseType: 'BOOLEAN' }), response({ valueBoolean: false }))
    ).toBe(true);
    expect(
      hasAnswer(checklistItem({ responseType: 'TEXT_SHORT' }), response({ valueText: '  ' }))
    ).toBe(false);
    expect(hasAnswer(checklistItem({ responseType: 'NUMBER' }), response({ valueText: '3' }))).toBe(
      false
    );
  });

  it('never counts an unknown type as answered', () => {
    expect(
      hasAnswer(checklistItem({ responseType: 'SIGNATURE' }), response({ valueText: 'x' }))
    ).toBe(false);
  });
});

describe('isFailure', () => {
  it('is a non-conforming answer, or "Não" on a yes/no item', () => {
    expect(isFailure(checklistItem(), response({ conformity: 'NON_CONFORMING' }))).toBe(true);
    expect(isFailure(checklistItem(), response({ conformity: 'NOT_APPLICABLE' }))).toBe(false);
    expect(
      isFailure(checklistItem({ responseType: 'BOOLEAN' }), response({ valueBoolean: false }))
    ).toBe(true);
    expect(isFailure(checklistItem(), undefined)).toBe(false);
  });
});

describe('isKnownResponseType', () => {
  it('accepts the seven MVP types only', () => {
    expect(isKnownResponseType('DATE')).toBe(true);
    expect(isKnownResponseType('THERMAL_IMAGE')).toBe(false);
  });
});
