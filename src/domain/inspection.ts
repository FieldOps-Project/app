/** Identifier of an inspection, used as a route parameter. */
export type InspectionId = string;

/** Lifecycle state of an inspection. */
export type InspectionStatus = 'pendente' | 'em-andamento' | 'concluida';

/**
 * Delivery state of a record relative to the server.
 *
 * Document 13.8 requires the technician to tell these apart at a glance, so the
 * state is part of the model rather than a transient message.
 */
export type SyncState =
  'salvo-no-dispositivo' | 'aguardando-envio' | 'enviado' | 'falha' | 'conflito';

/** Inspection as shown in a list. */
export interface InspectionSummary {
  readonly id: InspectionId;
  readonly client: string;
  readonly address: string;
  readonly scheduledFor: string;
  readonly status: InspectionStatus;
  readonly syncState: SyncState;
}

/** Single verifiable item of an inspection checklist. */
export interface ChecklistItem {
  readonly id: string;
  readonly order: number;
  readonly question: string;
  readonly requiresEvidence: boolean;
}

/** Human-readable label for a sync state, in business language (document 13.9). */
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

/** Human-readable label for an inspection status. */
export function inspectionStatusLabel(status: InspectionStatus): string {
  const labels: Record<InspectionStatus, string> = {
    pendente: 'Pendente',
    'em-andamento': 'Em andamento',
    concluida: 'Concluída',
  };
  return labels[status];
}
