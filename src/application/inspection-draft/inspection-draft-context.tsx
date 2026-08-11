import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface InspectionDraftContextValue {
  /** Checklist item the technician was working on when leaving for the camera. */
  focusedItemId: string | null;
  /** Marks the item the technician is acting on. */
  focusItem: (itemId: string) => void;
  /** Records one captured evidence for the item. */
  registerEvidence: (itemId: string) => void;
  /** Number of evidences already captured for the item. */
  evidenceCountFor: (itemId: string) => number;
}

const InspectionDraftContext = createContext<InspectionDraftContextValue | null>(null);

/**
 * Holds the in-progress checklist state shared by the checklist and the
 * evidence screens.
 *
 * Document 13.9 requires the technician to return to the same checklist item
 * after using the camera. Keeping the focused item and the evidence count above
 * both screens means neither depends on the other being mounted, and the
 * checklist can restore its position when it regains focus.
 *
 * The state is in memory only. Persisting a draft across restarts belongs to
 * EP-08, together with SQLite and the outbox.
 */
export function InspectionDraftProvider({ children }: { children: ReactNode }) {
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [evidenceByItem, setEvidenceByItem] = useState<Record<string, number>>({});

  const focusItem = useCallback((itemId: string) => {
    setFocusedItemId(itemId);
  }, []);

  const registerEvidence = useCallback((itemId: string) => {
    setEvidenceByItem((current) => ({ ...current, [itemId]: (current[itemId] ?? 0) + 1 }));
  }, []);

  const evidenceCountFor = useCallback(
    (itemId: string) => evidenceByItem[itemId] ?? 0,
    [evidenceByItem]
  );

  const value = useMemo<InspectionDraftContextValue>(
    () => ({ focusedItemId, focusItem, registerEvidence, evidenceCountFor }),
    [focusedItemId, focusItem, registerEvidence, evidenceCountFor]
  );

  return (
    <InspectionDraftContext.Provider value={value}>{children}</InspectionDraftContext.Provider>
  );
}

/**
 * Reads the inspection draft context.
 *
 * @throws When called outside {@link InspectionDraftProvider}.
 */
export function useInspectionDraft(): InspectionDraftContextValue {
  const value = useContext(InspectionDraftContext);
  if (value === null) {
    throw new Error('useInspectionDraft precisa estar dentro de InspectionDraftProvider.');
  }
  return value;
}
