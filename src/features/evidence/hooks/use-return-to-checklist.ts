import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Returns to the checklist without growing the stack: `dismissTo` unwinds to
 * the entry already there instead of pushing a second copy, keeping the depth
 * constant and the scroll position intact. With nothing to unwind to, such as a
 * deep link, the screen is replaced so no orphan entry is left behind.
 */
export function useReturnToChecklist(inspectionId: string): () => void {
  const router = useRouter();

  return useCallback(() => {
    const href = {
      pathname: '/inspections/[inspectionId]/checklist',
      params: { inspectionId },
    } as const;

    if (router.canDismiss()) {
      router.dismissTo(href);
      return;
    }
    router.replace(href);
  }, [router, inspectionId]);
}
