import { useMemo } from 'react';

import { useInspectionSummaries } from '@/application/inspections/use-inspections';
import type { InspectionSummary } from '@/domain/inspection';
import { filterInspections, type InspectionFilters } from '@/domain/inspection-filters';
import { isOverdue } from '@/domain/inspection-schedule';

export interface ListedInspection {
  readonly inspection: InspectionSummary;
  readonly overdue: boolean;
}

/**
 * The list screen's use case (card #10): the stored inspections, narrowed by
 * the technician's filters. Filtering is a view computed here; the stored
 * collection — and the device — are never touched by it.
 */
export function useInspectionList(filters: InspectionFilters, now: Date = new Date()) {
  const summaries = useInspectionSummaries();
  const day = now.toDateString();

  const visible = useMemo<readonly ListedInspection[]>(() => {
    const reference = new Date(day);
    return filterInspections(summaries.data ?? [], filters, reference).map((inspection) => ({
      inspection,
      overdue: isOverdue(inspection, reference),
    }));
  }, [summaries.data, filters, day]);

  return {
    visible,
    total: summaries.data?.length ?? 0,
    isLoading: summaries.isPending,
    isError: summaries.isError,
    reload: () => void summaries.refetch(),
  };
}
