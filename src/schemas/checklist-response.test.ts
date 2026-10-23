import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import {
  parseDecimal,
  responseFormSchema,
  toFormInput,
  type ResponseFormInput,
} from '@/schemas/checklist-response';

function item(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'item',
    sectionTitle: 'Geral',
    sectionDescription: null,
    sectionOrder: 1,
    itemCode: null,
    itemTitle: 'Item',
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
    itemOrder: 1,
    ...overrides,
  };
}

function parse(target: ChecklistItem, value: ResponseFormInput['value'], observation = '') {
  return responseFormSchema(target).safeParse({ value, observation });
}

function messages(result: ReturnType<typeof parse>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe('parseDecimal', () => {
  it('accepts the comma and the dot as decimal separator', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('-3')).toBe(-3);
  });

  it('refuses thousands separators and stray text', () => {
    expect(parseDecimal('1.234,5')).toBeNull();
    expect(parseDecimal('12a')).toBeNull();
    expect(parseDecimal('1e3')).toBeNull();
  });
});

describe('responseFormSchema', () => {
  it('fills only the column of the item type', () => {
    const result = parse(item({ responseType: 'NUMBER' }), '7,25');

    expect(result.success && result.data.columns).toEqual({
      valueText: null,
      valueNumber: 7.25,
      valueBoolean: null,
      valueDate: null,
      conformity: null,
    });
  });

  it('enforces the range frozen in the snapshot', () => {
    const gauge = item({
      responseType: 'NUMBER',
      rules: {
        observationRequiredOnFailure: false,
        evidenceRequiredOnFailure: false,
        min: 0,
        max: 10,
      },
    });

    expect(messages(parse(gauge, '10,5'))).toEqual(['O valor máximo é 10.']);
    expect(messages(parse(gauge, '-1'))).toEqual(['O valor mínimo é 0.']);
    expect(messages(parse(gauge, 'dez'))).toEqual(['Informe um número, como 12,5.']);
  });

  it('accepts only the options of the snapshot for a single choice', () => {
    const level = item({ responseType: 'SINGLE_CHOICE', options: ['Vazio', 'Cheio'] });

    expect(parse(level, 'Cheio').success).toBe(true);
    expect(messages(parse(level, 'Meio'))).toEqual(['Escolha uma das opções da lista.']);
  });

  it('limits text length and trims it', () => {
    const result = parse(item(), '  Lacre 123  ');
    expect(result.success && result.data.columns.valueText).toBe('Lacre 123');
    expect(messages(parse(item(), 'x'.repeat(256)))).toEqual(['Use no máximo 255 caracteres.']);
  });

  it('reads an empty value as "no answer", not as an error', () => {
    const result = parse(item({ responseType: 'CONFORMITY' }), null, '  ');

    expect(result.success && result.data).toEqual({
      columns: {
        valueText: null,
        valueNumber: null,
        valueBoolean: null,
        valueDate: null,
        conformity: null,
      },
      observation: null,
    });
  });

  it('refuses a date typed by hand', () => {
    expect(messages(parse(item({ responseType: 'DATE' }), '12/08/2026'))).toEqual([
      'Escolha a data no calendário.',
    ]);
  });
});

describe('toFormInput', () => {
  const stored: ChecklistResponse = {
    id: 'r',
    inspectionItemId: 'item',
    valueText: null,
    valueNumber: 12.5,
    valueBoolean: null,
    valueDate: null,
    conformity: null,
    observation: 'Leitura do painel.',
    answeredAtDevice: '2026-08-12T10:00:00Z',
  };

  it('shows a stored number with the decimal comma', () => {
    expect(toFormInput(item({ responseType: 'NUMBER' }), stored)).toEqual({
      value: '12,5',
      observation: 'Leitura do painel.',
    });
  });

  it('leaves a conformity unanswered rather than preselected', () => {
    expect(toFormInput(item({ responseType: 'CONFORMITY' }), undefined).value).toBeNull();
  });
});
