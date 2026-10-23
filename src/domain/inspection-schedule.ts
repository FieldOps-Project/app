import type { InspectionStatus, InspectionSummary } from '@/domain/inspection';

/** Work the technician still owes: assigned and not yet finished. */
const OPEN_STATUSES: readonly InspectionStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'];

export function isOpen(status: InspectionStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Midnight of the instant's calendar day, in the device's time zone. */
export function startOfDay(instant: Date): Date {
  const day = new Date(instant);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Scheduled for the device's current calendar day, in the device's time zone. */
export function isScheduledToday(
  inspection: Pick<InspectionSummary, 'scheduledFor'>,
  now: Date
): boolean {
  const scheduled = new Date(inspection.scheduledFor);
  return startOfDay(scheduled).getTime() === startOfDay(now).getTime();
}

/**
 * Overdue: the scheduled day is over and the work is still open. Same-day
 * inspections are never overdue — a 09:00 visit done at 15:00 is on time for
 * the technician.
 */
export function isOverdue(
  inspection: Pick<InspectionSummary, 'scheduledFor' | 'status'>,
  now: Date
): boolean {
  return (
    isOpen(inspection.status) &&
    new Date(inspection.scheduledFor).getTime() < startOfDay(now).getTime()
  );
}

/**
 * Preset views the home blocks open the list with (card #9). Each one is a
 * filter over the stored collection, never a separate copy of it.
 */
export const INSPECTION_VIEWS = ['today', 'overdue', 'in-progress', 'pending-sync'] as const;

export type InspectionView = (typeof INSPECTION_VIEWS)[number];

export function isInspectionView(value: string): value is InspectionView {
  return (INSPECTION_VIEWS as readonly string[]).includes(value);
}

/** Work not yet confirmed by the server, whatever its business status. */
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
  /** Inspections with work not yet confirmed by the server. */
  readonly withUnsentWork: number;
}
