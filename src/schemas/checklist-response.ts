import { z } from 'zod';

import type { ChecklistItem, ChecklistResponse, Conformity } from '@/domain/checklist';

/**
 * Validation of one checklist answer (card #13), derived from the item's type
 * and the rules frozen in its snapshot. Zod is the single source: the field
 * shows the same message the save would refuse with (RN-036).
 *
 * This is validity — is the value acceptable for the item. Completeness — is a
 * required item answered, does a failure carry its observation — belongs to
 * `computeProgress`, which the checklist, the detail and the summary share.
 */

export const TEXT_SHORT_MAX = 255;
export const TEXT_LONG_MAX = 4000;
export const OBSERVATION_MAX = 2000;

/** What a field holds while the technician edits it. */
export interface ResponseFormInput {
  /** Text, the number as typed, the chosen option, `YYYY-MM-DD`, or a conformity. */
  value: string | boolean | null;
  observation: string;
}

/** The typed columns of the API's response, only the one matching the type filled. */
export type ResponseColumns = Pick<
  ChecklistResponse,
  'valueText' | 'valueNumber' | 'valueBoolean' | 'valueDate' | 'conformity'
>;

export interface ResponseFormOutput {
  columns: ResponseColumns;
  observation: string | null;
}

const EMPTY_COLUMNS: ResponseColumns = {
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  conformity: null,
};

/**
 * Accepts the comma Brazilians type and the dot a hardware keyboard sends,
 * and nothing else: no thousands separator, no exponent, no stray text. The
 * API receives a number, so the conversion happens here, at the edge.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!/^-?\d+([.,]\d+)?$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed.replace(',', '.'));
}

/** The stored number as the technician reads it: decimal comma. */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

const CONFORMITIES: readonly string[] = ['CONFORMING', 'NON_CONFORMING', 'NOT_APPLICABLE'];

type Issue = (message: string) => void;

/**
 * A yes/no answer also carries its conformity, as in the API's own example
 * payload (backend#21): "Não" is the failure the item's rules react to, so
 * the observation and evidence required on failure (RN-038, RN-039) apply to
 * BOOLEAN items exactly as the server checks them on submit (backend#20).
 */
function booleanConformity(answer: boolean | null): Conformity | null {
  if (answer === null) {
    return null;
  }
  return answer ? 'CONFORMING' : 'NON_CONFORMING';
}

function optionalText(value: unknown, max: number, issue: Issue): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > max) {
    issue(`Use no máximo ${max} caracteres.`);
  }
  return text === '' ? null : text;
}

function numberValue(item: ChecklistItem, value: unknown, issue: Issue): number | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const parsed = parseDecimal(value);
  const { min, max } = item.rules;
  if (parsed === null) {
    issue('Informe um número, como 12,5.');
  } else if (min !== null && parsed < min) {
    issue(`O valor mínimo é ${formatDecimal(min)}.`);
  } else if (max !== null && parsed > max) {
    issue(`O valor máximo é ${formatDecimal(max)}.`);
  }
  return parsed;
}

/**
 * Reads the edited value into the typed column of the item's type, reporting
 * through `issue` what makes it invalid. An empty value is valid and means
 * "no answer"; whether the item may stay unanswered is completeness, not
 * validity.
 */
function toColumns(item: ChecklistItem, value: unknown, issue: Issue): ResponseColumns {
  switch (item.responseType) {
    case 'TEXT_SHORT':
      return { ...EMPTY_COLUMNS, valueText: optionalText(value, TEXT_SHORT_MAX, issue) };
    case 'TEXT_LONG':
      return { ...EMPTY_COLUMNS, valueText: optionalText(value, TEXT_LONG_MAX, issue) };
    case 'NUMBER':
      return { ...EMPTY_COLUMNS, valueNumber: numberValue(item, value, issue) };
    case 'BOOLEAN': {
      const answer = typeof value === 'boolean' ? value : null;
      return { ...EMPTY_COLUMNS, valueBoolean: answer, conformity: booleanConformity(answer) };
    }
    case 'CONFORMITY':
      return {
        ...EMPTY_COLUMNS,
        conformity:
          typeof value === 'string' && CONFORMITIES.includes(value) ? (value as Conformity) : null,
      };
    case 'SINGLE_CHOICE': {
      const choice = typeof value === 'string' ? value : null;
      if (choice !== null && !item.options.includes(choice)) {
        issue('Escolha uma das opções da lista.');
      }
      return { ...EMPTY_COLUMNS, valueText: choice };
    }
    case 'DATE': {
      const date = typeof value === 'string' && value !== '' ? value : null;
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        issue('Escolha a data no calendário.');
      }
      return { ...EMPTY_COLUMNS, valueDate: date };
    }
    default:
      issue('Este tipo de resposta não é suportado por esta versão do aplicativo.');
      return EMPTY_COLUMNS;
  }
}

/** The form schema of one item: its value by type, and the free observation. */
export function responseFormSchema(item: ChecklistItem) {
  return z
    .object({
      value: z
        .union([z.string(), z.boolean(), z.null()])
        .transform((value, context) =>
          toColumns(item, value, (message) => context.addIssue({ code: 'custom', message }))
        ),
      observation: z
        .string()
        .max(OBSERVATION_MAX, `Use no máximo ${OBSERVATION_MAX} caracteres.`)
        .transform((text) => (text.trim() === '' ? null : text.trim())),
    })
    .transform(({ value, observation }): ResponseFormOutput => ({ columns: value, observation }));
}

/** Puts a stored answer back into the shape the field edits. */
export function toFormInput(
  item: ChecklistItem,
  response: ChecklistResponse | undefined
): ResponseFormInput {
  const observation = response?.observation ?? '';
  if (response === undefined) {
    const typed = ['TEXT_SHORT', 'TEXT_LONG', 'NUMBER'].includes(item.responseType);
    return { value: typed ? '' : null, observation };
  }

  switch (item.responseType) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
      return { value: response.valueText ?? '', observation };
    case 'NUMBER':
      return {
        value: response.valueNumber === null ? '' : formatDecimal(response.valueNumber),
        observation,
      };
    case 'BOOLEAN':
      return { value: response.valueBoolean, observation };
    case 'CONFORMITY':
      return { value: response.conformity, observation };
    case 'SINGLE_CHOICE':
      return { value: response.valueText, observation };
    case 'DATE':
      return { value: response.valueDate, observation };
    default:
      return { value: null, observation };
  }
}

/** Nothing to save: no value and no observation. */
export function isEmptyAnswer({ columns, observation }: ResponseFormOutput): boolean {
  return observation === null && Object.values(columns).every((value) => value === null);
}

/** The answer is what is already stored, so saving it again would only queue a no-op. */
export function isSameAnswer(
  { columns, observation }: ResponseFormOutput,
  stored: ChecklistResponse | undefined
): boolean {
  return (
    (stored?.valueText ?? null) === columns.valueText &&
    (stored?.valueNumber ?? null) === columns.valueNumber &&
    (stored?.valueBoolean ?? null) === columns.valueBoolean &&
    (stored?.valueDate ?? null) === columns.valueDate &&
    (stored?.conformity ?? null) === columns.conformity &&
    (stored?.observation ?? null) === observation
  );
}
