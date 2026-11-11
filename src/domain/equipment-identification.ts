import type { InspectionEquipment, InspectionStatus } from '@/domain/inspection';

export interface EquipmentInspection {
  readonly id: string;
  readonly title: string;
  readonly status: InspectionStatus;
  readonly scheduledFor: string;
}

export interface EquipmentMatch {
  readonly equipment: InspectionEquipment;
  readonly inspections: readonly EquipmentInspection[];
}

export type EquipmentIdentification =
  | { readonly kind: 'confirmed'; readonly equipment: InspectionEquipment }
  | {
      readonly kind: 'divergent';
      readonly expected: InspectionEquipment;
      readonly read: EquipmentMatch;
    }
  | { readonly kind: 'found'; readonly match: EquipmentMatch }
  | { readonly kind: 'not-found'; readonly offline: boolean };

export const EQUIPMENT_CODE_MAX = 120;

export function normalizeEquipmentCode(raw: string): string | null {
  const code = raw.trim();
  return code === '' || code.length > EQUIPMENT_CODE_MAX ? null : code;
}

export function identifyEquipment(
  expected: InspectionEquipment | null,
  match: EquipmentMatch | null,
  offline: boolean
): EquipmentIdentification {
  if (match === null) {
    return { kind: 'not-found', offline };
  }
  if (expected === null) {
    return { kind: 'found', match };
  }
  return match.equipment.id === expected.id
    ? { kind: 'confirmed', equipment: expected }
    : { kind: 'divergent', expected, read: match };
}
