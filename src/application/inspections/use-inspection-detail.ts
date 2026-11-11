import { useMemo } from 'react';

import { useStoredInspection } from '@/application/inspections/use-inspections';
import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import type { EvidenceSummary } from '@/domain/evidence';
import { computeProgress, type ChecklistProgress } from '@/domain/checklist-progress';
import type { InspectionDetail } from '@/domain/inspection';

export interface InspectionWork {
  readonly detail: InspectionDetail;
  readonly items: readonly ChecklistItem[];
  readonly responses: ReadonlyMap<string, ChecklistResponse>;
  readonly evidenceCounts: ReadonlyMap<string, number>;
  readonly evidences: Readonly<Record<string, readonly EvidenceSummary[]>>;
  readonly progress: ChecklistProgress;
}

export type InspectionDetailState =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly retry: () => void }
  | { readonly state: 'not-found' }
  | ({ readonly state: 'ready' } & InspectionWork);

export function useInspectionDetail(inspectionId: string): InspectionDetailState {
  const stored = useStoredInspection(inspectionId);

  const work = useMemo<InspectionWork | null>(() => {
    if (stored.data == null) {
      return null;
    }
    const responses = new Map(
      stored.data.responses.map((response) => [response.inspectionItemId, response])
    );
    return {
      detail: stored.data.detail,
      items: stored.data.items,
      responses,
      evidenceCounts: stored.data.evidenceCounts,
      evidences: stored.data.evidences,
      progress: computeProgress({
        items: stored.data.items,
        responses,
        evidenceCounts: stored.data.evidenceCounts,
      }),
    };
  }, [stored.data]);

  if (inspectionId === '') {
    return { state: 'not-found' };
  }
  if (stored.isError) {
    return { state: 'error', retry: () => void stored.refetch() };
  }
  if (stored.isPending) {
    return { state: 'loading' };
  }
  if (work === null) {
    return { state: 'not-found' };
  }
  return { state: 'ready', ...work };
}
