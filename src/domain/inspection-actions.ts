import type { InspectionStatus, SyncState } from '@/domain/inspection';

export type InspectionAction = 'START' | 'CONTINUE' | 'CORRECT' | 'VIEW';

export function contextualAction(status: InspectionStatus): InspectionAction {
  switch (status) {
    case 'ASSIGNED':
      return 'START';
    case 'IN_PROGRESS':
      return 'CONTINUE';
    case 'REJECTED':
      return 'CORRECT';
    default:
      return 'VIEW';
  }
}

export function contextualActionLabel(action: InspectionAction): string {
  const labels: Record<InspectionAction, string> = {
    START: 'Iniciar inspeção',
    CONTINUE: 'Continuar',
    CORRECT: 'Corrigir',
    VIEW: 'Consultar checklist',
  };
  return labels[action];
}

export function canStart(status: InspectionStatus): boolean {
  return status === 'ASSIGNED';
}

export function canEditAnswers(status: InspectionStatus): boolean {
  return status === 'IN_PROGRESS';
}

export function startBlockedReason(status: InspectionStatus): string | null {
  if (canStart(status)) {
    return null;
  }
  switch (status) {
    case 'CANCELED':
      return 'Esta inspeção foi cancelada e não pode ser iniciada.';
    case 'IN_PROGRESS':
      return 'Esta inspeção já foi iniciada.';
    case 'DRAFT':
      return 'Esta inspeção ainda não foi atribuída.';
    case 'REJECTED':
      return 'Esta inspeção foi reprovada e aguarda reabertura para correção.';
    default:
      return 'Esta inspeção já foi concluída e não pode ser iniciada novamente.';
  }
}

export function isAwaitingSend(status: InspectionStatus, syncState: SyncState): boolean {
  return status === 'SUBMITTED' && syncState !== 'enviado' && syncState !== 'salvo-no-dispositivo';
}
