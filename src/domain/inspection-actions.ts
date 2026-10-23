import type { InspectionStatus } from '@/domain/inspection';

/** The single action the detail offers for a given state (card #11). */
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

/** RN-032: only an assigned inspection can be started. */
export function canStart(status: InspectionStatus): boolean {
  return status === 'ASSIGNED';
}

/**
 * Answers are editable only while the inspection is in progress. After the
 * local completion they stay locked until a rejection is reopened for
 * correction (RN-043, card #30).
 */
export function canEditAnswers(status: InspectionStatus): boolean {
  return status === 'IN_PROGRESS';
}

/** Why the start is refused, in business language, or `null` when allowed. */
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
    default:
      return 'Esta inspeção já foi concluída e não pode ser iniciada novamente.';
  }
}
