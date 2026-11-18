import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useReturnToChecklist } from '@/features/checklist/hooks/use-return-to-checklist';

export function useReturnFromEvidence(inspectionId: string, nonConformityId: string): () => void {
  const router = useRouter();
  const returnToChecklist = useReturnToChecklist(inspectionId);

  return useCallback(() => {
    if (nonConformityId === '') {
      returnToChecklist();
      return;
    }
    const href = {
      pathname: '/inspections/[inspectionId]/non-conformities',
      params: { inspectionId },
    } as const;
    if (router.canDismiss()) {
      router.dismissTo(href);
      return;
    }
    router.replace(href);
  }, [router, inspectionId, nonConformityId, returnToChecklist]);
}
