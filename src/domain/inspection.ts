import type { RecordedLocation } from '@/domain/field-location';

export type InspectionId = string;

export const INSPECTION_STATUSES = [
  'DRAFT',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELED',
] as const;

export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export type InspectionPriority = (typeof INSPECTION_PRIORITIES)[number];

export type SyncState =
  'salvo-no-dispositivo' | 'aguardando-envio' | 'enviado' | 'falha' | 'conflito';

export interface InspectionSummary {
  readonly id: InspectionId;
  readonly title: string;
  readonly status: InspectionStatus;
  readonly priority: InspectionPriority;
  readonly scheduledFor: string;
  readonly clientName: string;
  readonly siteName: string;
  readonly equipmentName: string | null;
  readonly syncState: SyncState;
}

export interface InspectionSite {
  readonly id: string;
  readonly name: string;
  readonly addressLine: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface InspectionEquipment {
  readonly id: string;
  readonly name: string;
  readonly qrCode: string | null;
  readonly assetNumber: string | null;
  readonly serialNumber: string | null;
}

export interface InspectionReview {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly reason: string | null;
  readonly itemsToCorrect: readonly string[];
}

export interface InspectionDetail extends InspectionSummary {
  readonly instructions: string | null;
  readonly version: number;
  readonly client: { readonly id: string; readonly name: string };
  readonly site: InspectionSite;
  readonly equipment: InspectionEquipment | null;
  readonly startedAtDevice: string | null;
  readonly completedAtDevice: string | null;
  readonly startLocation: RecordedLocation;
  readonly completionLocation: RecordedLocation;
  readonly review: InspectionReview | null;
  readonly syncError: string | null;
}

export function syncStateLabel(state: SyncState): string {
  const labels: Record<SyncState, string> = {
    'salvo-no-dispositivo': 'Salvo no dispositivo',
    'aguardando-envio': 'Aguardando envio',
    enviado: 'Enviado',
    falha: 'Falha no envio',
    conflito: 'Conflito',
  };
  return labels[state];
}

export function inspectionStatusLabel(status: InspectionStatus): string {
  const labels: Record<InspectionStatus, string> = {
    DRAFT: 'Rascunho',
    ASSIGNED: 'Atribuída',
    IN_PROGRESS: 'Em andamento',
    SUBMITTED: 'Concluída',
    UNDER_REVIEW: 'Em revisão',
    APPROVED: 'Aprovada',
    REJECTED: 'Reprovada',
    CANCELED: 'Cancelada',
  };
  return labels[status];
}

export function priorityLabel(priority: InspectionPriority): string {
  const labels: Record<InspectionPriority, string> = {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  };
  return labels[priority];
}

export function isInspectionStatus(value: string): value is InspectionStatus {
  return (INSPECTION_STATUSES as readonly string[]).includes(value);
}

export function isInspectionPriority(value: string): value is InspectionPriority {
  return (INSPECTION_PRIORITIES as readonly string[]).includes(value);
}

export function isUrgentPriority(priority: InspectionPriority): boolean {
  return priority === 'HIGH' || priority === 'CRITICAL';
}
