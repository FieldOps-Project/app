import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Unwinds to the checklist without growing the stack: `dismissTo` returns to
 * the entry already there instead of pushing a second copy, keeping the depth
 * constant and the scroll position intact. With nothing to unwind to, such as a
 * deep link, the screen is replaced so no orphan entry is left behind.
 */
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

/** Back to the checklist where it was, as the camera screens do. */
export function useReturnToChecklist(inspectionId: string): () => void {
  const navigate = useChecklistNavigation(inspectionId);
  return useCallback(() => navigate(null), [navigate]);
}

/**
 * Back to the checklist, scrolled to one item — the summary's pending list.
 * A separate hook rather than an optional argument, so passing it straight
 * as a press handler can never turn the event into an item id.
 */
export function useReturnToChecklistItem(inspectionId: string): (itemId: string) => void {
  const navigate = useChecklistNavigation(inspectionId);
  return useCallback((itemId: string) => navigate(itemId), [navigate]);
}
