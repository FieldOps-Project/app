export type InspectionId = string;

export type InspectionStatus = 'pendente' | 'em-andamento' | 'concluida';

/** Document 13.8 requires these to be told apart at a glance. */
export type SyncState =
  'salvo-no-dispositivo' | 'aguardando-envio' | 'enviado' | 'falha' | 'conflito';

export interface InspectionSummary {
  readonly id: InspectionId;
  readonly client: string;
  readonly address: string;
  readonly scheduledFor: string;
  readonly status: InspectionStatus;
  readonly syncState: SyncState;
}

export interface ChecklistItem {
  readonly id: string;
  readonly order: number;
  readonly question: string;
  readonly requiresEvidence: boolean;
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

export function inspectionStatusLabel(status: InspectionStatus): string {
  const labels: Record<InspectionStatus, string> = {
    pendente: 'Pendente',
    'em-andamento': 'Em andamento',
    concluida: 'Concluída',
  };
  return labels[status];
}
