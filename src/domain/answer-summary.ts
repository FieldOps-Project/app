import type { Conformity } from '@/domain/checklist';

export interface AnswerValues {
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly conformity: Conformity | null;
  readonly observation: string | null;
}

const CONFORMITY_LABELS: Readonly<Record<Conformity, string>> = {
  CONFORMING: 'Conforme',
  NON_CONFORMING: 'Não conforme',
  NOT_APPLICABLE: 'Não se aplica',
};

const EMPTY = 'Sem resposta';

function headline(values: AnswerValues): string | null {
  if (values.conformity !== null) {
    return CONFORMITY_LABELS[values.conformity];
  }
  if (values.valueBoolean !== null) {
    return values.valueBoolean ? 'Sim' : 'Não';
  }
  if (values.valueNumber !== null) {
    return String(values.valueNumber);
  }
  if (values.valueDate !== null) {
    return values.valueDate;
  }
  if (values.valueText !== null && values.valueText.trim() !== '') {
    return values.valueText.trim();
  }
  return null;
}

export function summarizeAnswer(values: AnswerValues): string {
  const main = headline(values);
  const note = values.observation?.trim() ?? '';
  if (main === null) {
    return note === '' ? EMPTY : `Observação: ${note}`;
  }
  return note === '' ? main : `${main} — Observação: ${note}`;
}

export function sameAnswer(left: AnswerValues, right: AnswerValues): boolean {
  return summarizeAnswer(left) === summarizeAnswer(right);
}
