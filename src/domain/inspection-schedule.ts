import type { InspectionStatus, InspectionSummary } from '@/domain/inspection';

const OPEN_STATUSES: readonly InspectionStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'];

export function isOpen(status: InspectionStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function startOfDay(instant: Date): Date {
  const day = new Date(instant);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function isScheduledToday(
  inspection: Pick<InspectionSummary, 'scheduledFor'>,
  now: Date
): boolean {
  const scheduled = new Date(inspection.scheduledFor);
  return startOfDay(scheduled).getTime() === startOfDay(now).getTime();
}

export function isOverdue(
  inspection: Pick<InspectionSummary, 'scheduledFor' | 'status'>,
  now: Date
): boolean {
  return (
    isOpen(inspection.status) &&
    new Date(inspection.scheduledFor).getTime() < startOfDay(now).getTime()
  );
}

export const INSPECTION_VIEWS = ['today', 'overdue', 'in-progress', 'pending-sync'] as const;

export type InspectionView = (typeof INSPECTION_VIEWS)[number];

export function isInspectionView(value: string): value is InspectionView {
  return (INSPECTION_VIEWS as readonly string[]).includes(value);
}

export function hasUnsentWork(inspection: Pick<InspectionSummary, 'syncState'>): boolean {
  return (
    inspection.syncState === 'aguardando-envio' ||
    inspection.syncState === 'falha' ||
    inspection.syncState === 'conflito'
  );
}

export interface DayOverview {
  readonly today: number;
  readonly overdue: number;
  readonly inProgress: number;
  readonly withUnsentWork: number;
}
