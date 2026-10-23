/** Response types this version of the app knows how to render (document 13.5). */
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

/** Item rules copied into the snapshot when the inspection was scheduled. */
export interface ItemRules {
  /** RN-038: a failed answer needs an observation. */
  readonly observationRequiredOnFailure: boolean;
  /** RN-039: a failed answer needs at least one evidence. */
  readonly evidenceRequiredOnFailure: boolean;
  readonly min: number | null;
  readonly max: number | null;
}

/**
 * One item of the inspection's frozen checklist (RN-021). Text and rules come
 * from the snapshot, never from the current template.
 *
 * `responseType` stays a plain string: a newer panel may publish a type this
 * version does not know, and that must reach the screen as data, not as a
 * parsing failure that hides the whole checklist.
 */
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
  /** SINGLE_CHOICE options, exactly as published. */
  readonly options: readonly string[];
  readonly itemOrder: number;
}

/**
 * The current answer to an item (RN-035), in the API's typed columns. Only the
 * column matching the item's type is filled; `observation` is free on any item.
 */
export interface ChecklistResponse {
  /** Generated on the device, so a resend updates instead of duplicating (RN-068). */
  readonly id: string;
  readonly inspectionItemId: string;
  readonly valueText: string | null;
  readonly valueNumber: number | null;
  readonly valueBoolean: boolean | null;
  /** Calendar date, `YYYY-MM-DD`. */
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

/**
 * Groups the snapshot into sections following `sectionOrder`, then
 * `itemOrder`. These are the snapshot's own positions: the app never invents
 * an order of its own.
 */
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

/** True when the column matching the item's type holds a value. */
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

/** "Não aplicável" resolves the item without being a failure (RN-040). */
export function isNotApplicable(response: ChecklistResponse | undefined): boolean {
  return response?.conformity === 'NOT_APPLICABLE';
}

/**
 * A failed answer is what the failure rules (RN-038, RN-039) react to: a
 * non-conforming answer, exactly as the server checks it on submit
 * (backend#20). Kept identical to the server on purpose — a stricter app would
 * block completions the server accepts, a looser one would let through
 * completions it refuses.
 */
export function isFailure(response: ChecklistResponse | undefined): boolean {
  return response?.conformity === 'NON_CONFORMING';
}
