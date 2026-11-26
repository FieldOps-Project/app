import { isConformity, type ChecklistItem, type ChecklistResponse } from '@/domain/checklist';
import {
  OBSERVATION_MAX,
  TEXT_LONG_MAX,
  TEXT_SHORT_MAX,
  type ResponseColumns,
} from '@/schemas/checklist-response';

type ColumnName = keyof ResponseColumns;

const TYPE_COLUMNS: Readonly<Record<string, readonly ColumnName[]>> = {
  TEXT_SHORT: ['valueText'],
  TEXT_LONG: ['valueText'],
  SINGLE_CHOICE: ['valueText'],
  NUMBER: ['valueNumber'],
  BOOLEAN: ['valueBoolean', 'conformity'],
  CONFORMITY: ['conformity'],
  DATE: ['valueDate'],
};

const ALL_COLUMNS: readonly ColumnName[] = [
  'valueText',
  'valueNumber',
  'valueBoolean',
  'valueDate',
  'conformity',
];

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function valueIssue(item: ChecklistItem, response: ChecklistResponse): string | null {
  switch (item.responseType) {
    case 'TEXT_SHORT':
      return (response.valueText?.length ?? 0) > TEXT_SHORT_MAX ? 'O texto é longo demais.' : null;
    case 'TEXT_LONG':
      return (response.valueText?.length ?? 0) > TEXT_LONG_MAX ? 'O texto é longo demais.' : null;
    case 'SINGLE_CHOICE':
      return response.valueText !== null && !item.options.includes(response.valueText)
        ? 'A opção escolhida não existe neste item.'
        : null;
    case 'NUMBER': {
      const { valueNumber } = response;
      const { min, max } = item.rules;
      if (valueNumber === null) {
        return null;
      }
      if (!Number.isFinite(valueNumber)) {
        return 'O valor numérico é inválido.';
      }
      if ((min !== null && valueNumber < min) || (max !== null && valueNumber > max)) {
        return 'O valor está fora do intervalo permitido.';
      }
      return null;
    }
    case 'CONFORMITY':
      return response.conformity !== null && !isConformity(response.conformity)
        ? 'A conformidade informada é inválida.'
        : null;
    case 'DATE':
      return response.valueDate !== null && !isRealDate(response.valueDate)
        ? 'A data informada é inválida.'
        : null;
    default:
      return null;
  }
}

export function responseIssue(item: ChecklistItem, response: ChecklistResponse): string | null {
  const allowed = TYPE_COLUMNS[item.responseType];
  if (allowed === undefined) {
    return 'Este tipo de resposta não é suportado por esta versão do aplicativo.';
  }
  if (ALL_COLUMNS.some((column) => response[column] !== null && !allowed.includes(column))) {
    return 'O valor não combina com o tipo deste item.';
  }
  if ((response.observation?.length ?? 0) > OBSERVATION_MAX) {
    return 'A observação é longa demais.';
  }
  return valueIssue(item, response);
}
