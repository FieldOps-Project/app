import { useMemo } from 'react';

import {
  useInspectionSummaries,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { summarizeDay } from '@/domain/inspection-filters';
import { startOfDay, type DayOverview } from '@/domain/inspection-schedule';

export type HomeOverview =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly retry: () => void }
  | {
      readonly state: 'ready';
      readonly day: DayOverview;
      readonly pendingOperations: number;
    };

export function useHomeOverview(now: Date = new Date()): HomeOverview {
  const summaries = useInspectionSummaries();
  const pending = usePendingOperationsCount();
  const day = startOfDay(now).getTime();

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
