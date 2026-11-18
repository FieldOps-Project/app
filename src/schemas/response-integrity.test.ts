import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import { TEXT_LONG_MAX, TEXT_SHORT_MAX } from '@/schemas/checklist-response';
import { responseIssue } from '@/schemas/response-integrity';

function item(responseType: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item-1',
    sectionTitle: 'Geral',
    sectionDescription: null,
    sectionOrder: 1,
    itemCode: null,
    itemTitle: 'Item',
    itemDescription: null,
    responseType,
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

function answer(overrides: Partial<ChecklistResponse> = {}): ChecklistResponse {
  return {
    id: 'resp-1',
    inspectionItemId: 'item-1',
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

describe('responseIssue accepts what each type allows', () => {
  it.each([
    ['TEXT_SHORT', answer({ valueText: 'ok' })],
    ['TEXT_LONG', answer({ valueText: 'a'.repeat(TEXT_LONG_MAX) })],
    ['NUMBER', answer({ valueNumber: 12.5 })],
    ['BOOLEAN', answer({ valueBoolean: true, conformity: 'CONFORMING' })],
    ['CONFORMITY', answer({ conformity: 'NON_CONFORMING' })],
    ['DATE', answer({ valueDate: '2026-02-28' })],
    ['TEXT_SHORT', answer()],
  ])('%s', (type, response) => {
    expect(responseIssue(item(type), response)).toBeNull();
  });

  it('accepts a listed choice', () => {
    expect(
      responseIssue(item('SINGLE_CHOICE', { options: ['A', 'B'] }), answer({ valueText: 'B' }))
    ).toBeNull();
  });
});

describe('responseIssue refuses what it does not', () => {
  it.each([
    [
      'text above the short limit',
      item('TEXT_SHORT'),
      answer({ valueText: 'a'.repeat(TEXT_SHORT_MAX + 1) }),
    ],
    [
      'a choice that is not listed',
      item('SINGLE_CHOICE', { options: ['A'] }),
      answer({ valueText: 'Z' }),
    ],
    [
      'a number below the minimum',
      item('NUMBER', { rules: { ...item('NUMBER').rules, min: 5 } }),
      answer({ valueNumber: 4 }),
    ],
    [
      'a number above the maximum',
      item('NUMBER', { rules: { ...item('NUMBER').rules, max: 5 } }),
      answer({ valueNumber: 6 }),
    ],
    ['a number that is not finite', item('NUMBER'), answer({ valueNumber: Number.NaN })],
    ['an impossible date', item('DATE'), answer({ valueDate: '2026-02-30' })],
    ['a date in another format', item('DATE'), answer({ valueDate: '28/02/2026' })],
    [
      'a conformity that does not exist',
      item('CONFORMITY'),
      answer({ conformity: 'MAYBE' as never }),
    ],
    ['a text for a number item', item('NUMBER'), answer({ valueText: 'abc' })],
    ['a number for a text item', item('TEXT_SHORT'), answer({ valueNumber: 3 })],
    [
      'an observation above the limit',
      item('CONFORMITY'),
      answer({ observation: 'a'.repeat(2001) }),
    ],
  ])('%s', (_name, definition, response) => {
    expect(responseIssue(definition, response)).not.toBeNull();
  });

  it('refuses any value for a type this version does not know', () => {
    expect(responseIssue(item('THERMAL_IMAGE'), answer())).toContain('não é suportado');
  });
});
