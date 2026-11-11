import { useRouter } from 'expo-router';
import { useCallback } from 'react';

function useChecklistNavigation(inspectionId: string) {
  const router = useRouter();

  return useCallback(
    (itemId: string | null) => {
      const href = {
        pathname: '/inspections/[inspectionId]/checklist',
        params: itemId === null ? { inspectionId } : { inspectionId, itemId },
      } as const;

      if (router.canDismiss()) {
        router.dismissTo(href);
        return;
      }
      router.replace(href);
    },
    [router, inspectionId]
  );
}

export function useReturnToChecklist(inspectionId: string): () => void {
  const navigate = useChecklistNavigation(inspectionId);
  return useCallback(() => navigate(null), [navigate]);
}

export function useReturnToChecklistItem(inspectionId: string): (itemId: string) => void {
  const navigate = useChecklistNavigation(inspectionId);
  return useCallback((itemId: string) => navigate(itemId), [navigate]);
}
