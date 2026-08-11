import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Returns to the checklist of an inspection without growing the stack.
 *
 * `dismissTo` unwinds to the checklist entry already in the stack instead of
 * pushing a second copy, so opening the camera repeatedly keeps the stack at a
 * constant depth and the checklist keeps the scroll position it had.
 *
 * When the checklist is not in the stack — for instance if the capture route is
 * opened directly by a deep link — there is nothing to unwind to, and the
 * screen is replaced so no orphan entry is left behind.
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
