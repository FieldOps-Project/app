export type InspectionId = string;

/** Business states of an inspection (document 7.6), as the API names them. */
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

/**
 * Local delivery state of a record (document 13.8). Independent of the business
 * status: an inspection can be in progress and waiting to be sent at once
 * (document 7.5).
 */
export type SyncState =
  'salvo-no-dispositivo' | 'aguardando-envio' | 'enviado' | 'falha' | 'conflito';

/** What a list card shows: enough to pick the inspection without opening it. */
export interface InspectionSummary {
  readonly id: InspectionId;
  readonly title: string;
  readonly status: InspectionStatus;
  readonly priority: InspectionPriority;
  /** ISO 8601 instant. */
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
  /** Registered coordinates of the site, never the position captured in the field. */
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

/** The supervisor's decision, present once the inspection was reviewed. */
export interface InspectionReview {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly reason: string | null;
  /** Snapshot item ids the technician has to correct. */
  readonly itemsToCorrect: readonly string[];
}

export interface InspectionDetail extends InspectionSummary {
  readonly instructions: string | null;
  /** Server version, carried as `baseVersion` by every queued operation. */
  readonly version: number;
  readonly client: { readonly id: string; readonly name: string };
  readonly site: InspectionSite;
  readonly equipment: InspectionEquipment | null;
  /** Device clock at the moment the technician started (RN-034). */
  readonly startedAtDevice: string | null;
  /** Device clock at the moment the technician completed (RN-042). */
  readonly completedAtDevice: string | null;
  readonly review: InspectionReview | null;
}

/** Business language, not API wording (document 13.9). */
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

/**
 * SUBMITTED reads as "Concluída": on the device it is set the moment the
 * technician completes, before anything reached the server. The sync badge is
 * what tells "concluída" apart from "enviada".
 */
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

/** High and critical work is flagged on the card so it stands out in a long list. */
export function isUrgentPriority(priority: InspectionPriority): boolean {
  return priority === 'HIGH' || priority === 'CRITICAL';
}
