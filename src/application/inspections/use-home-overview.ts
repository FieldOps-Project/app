import { useMemo } from 'react';

import {
  useInspectionSummaries,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { summarizeDay, type DayOverview } from '@/domain/inspection-schedule';

export type HomeOverview =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly retry: () => void }
  | {
      readonly state: 'ready';
      readonly day: DayOverview;
      /** RN-071: operations still owed to the server. */
      readonly pendingOperations: number;
    };

/**
 * The home screen's use case (card #9): the day's blocks and the pending
 * operations, computed from what is stored on the device. The screen never
 * reaches the source directly, so moving from the API to SQLite — or anything
 * after it — does not touch it.
 */
export function useHomeOverview(now: Date = new Date()): HomeOverview {
  const summaries = useInspectionSummaries();
  const pending = usePendingOperationsCount();
  const day = now.toDateString();

  const overview = useMemo(
    () => (summaries.data === undefined ? null : summarizeDay(summaries.data, new Date(day))),
    [summaries.data, day]
  );

  if (summaries.isError || pending.isError) {
    return {
      state: 'error',
      retry: () => {
        void summaries.refetch();
        void pending.refetch();
      },
    };
  }
  if (overview === null || pending.data === undefined) {
    return { state: 'loading' };
  }
  return { state: 'ready', day: overview, pendingOperations: pending.data };
}
