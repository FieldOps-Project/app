import type { ChecklistResponse } from '@/domain/checklist';
import type { SyncState } from '@/domain/inspection';

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Readonly<Record<Severity, string>> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const NON_CONFORMITY_TITLE_MAX = 120;
export const NON_CONFORMITY_DESCRIPTION_MAX = 2000;

export interface NonConformity {
  readonly id: string;
  readonly inspectionId: string;
  readonly inspectionItemId: string | null;
  readonly itemTitle: string | null;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
  readonly createdAtDevice: string;
  readonly syncState: SyncState;
  readonly evidenceCount: number;
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as readonly string[]).includes(value);
}

export function lacksRequiredEvidence(nonConformity: NonConformity): boolean {
  return nonConformity.severity === 'CRITICAL' && nonConformity.evidenceCount === 0;
}

export function blockingCompletion(
  nonConformities: readonly NonConformity[]
): readonly NonConformity[] {
  return nonConformities.filter(lacksRequiredEvidence);
}

export function suggestsNonConformity(response: ChecklistResponse | undefined): boolean {
  return response?.conformity === 'NON_CONFORMING';
}

export function canDeleteLocally(nonConformity: NonConformity): boolean {
  return nonConformity.syncState !== 'enviado';
}
