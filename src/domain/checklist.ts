export const RESPONSE_TYPES = [
  'TEXT_SHORT',
  'TEXT_LONG',
  'NUMBER',
  'BOOLEAN',
  'CONFORMITY',
  'SINGLE_CHOICE',
  'DATE',
] as const;

export type ResponseType = (typeof RESPONSE_TYPES)[number];

export type Conformity = 'CONFORMING' | 'NON_CONFORMING' | 'NOT_APPLICABLE';

export interface ItemRules {
  readonly observationRequiredOnFailure: boolean;
  readonly evidenceRequiredOnFailure: boolean;
  readonly min: number | null;
  readonly max: number | null;
}

export interface ChecklistItem {
  readonly id: string;
  readonly sectionTitle: string;
  readonly sectionDescription: string | null;
  readonly sectionOrder: number;
  readonly itemCode: string | null;
  readonly itemTitle: string;
  readonly itemDescription: string | null;
  readonly responseType: string;
  readonly required: boolean;
  readonly rules: ItemRules;
  readonly options: readonly string[];
  readonly itemOrder: number;
}

export interface ChecklistResponse {
  readonly id: string;
  readonly inspectionItemId: string;
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: boolean | null;
  readonly valueDate: string | null;
  readonly conformity: Conformity | null;
  readonly observation: string | null;
  readonly answeredAtDevice: string;
}

export interface ChecklistSection {
  readonly order: number;
  readonly title: string;
  readonly description: string | null;
  readonly items: readonly ChecklistItem[];
}

export function isKnownResponseType(type: string): type is ResponseType {
  return (RESPONSE_TYPES as readonly string[]).includes(type);
}

export function toSections(items: readonly ChecklistItem[]): readonly ChecklistSection[] {
  const ordered = [...items].sort(
    (left, right) => left.sectionOrder - right.sectionOrder || left.itemOrder - right.itemOrder
  );

  const sections: {
    order: number;
    title: string;
    description: string | null;
    items: ChecklistItem[];
  }[] = [];
  for (const item of ordered) {
    const last = sections[sections.length - 1];
    if (last !== undefined && last.order === item.sectionOrder) {
      last.items.push(item);
    } else {
      sections.push({
        order: item.sectionOrder,
        title: item.sectionTitle,
        description: item.sectionDescription,
        items: [item],
      });
    }
  }
  return sections;
}

export function hasAnswer(item: ChecklistItem, response: ChecklistResponse | undefined): boolean {
  if (response === undefined) {
    return false;
  }

  switch (item.responseType) {
    case 'TEXT_SHORT':
    case 'TEXT_LONG':
    case 'SINGLE_CHOICE':
      return response.valueText !== null && response.valueText.trim() !== '';
    case 'NUMBER':
      return response.valueNumber !== null;
    case 'BOOLEAN':
      return response.valueBoolean !== null;
    case 'CONFORMITY':
      return response.conformity !== null;
    case 'DATE':
      return response.valueDate !== null;
    default:
      return false;
  }
}

export function isNotApplicable(response: ChecklistResponse | undefined): boolean {
  return response?.conformity === 'NOT_APPLICABLE';
}

export function isFailure(response: ChecklistResponse | undefined): boolean {
  return response?.conformity === 'NON_CONFORMING';
}
