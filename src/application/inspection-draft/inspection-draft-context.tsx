import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface InspectionDraftContextValue {
  focusedItemId: string | null;
  focusItem: (itemId: string) => void;
  registerEvidence: (itemId: string) => void;
  evidenceCountFor: (itemId: string) => number;
}

const InspectionDraftContext = createContext<InspectionDraftContextValue | null>(null);

/**
 * Checklist state shared with the evidence screens, so neither depends on the
 * other being mounted (document 13.9). In memory only; persisting a draft
 * belongs to EP-08.
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

export function useInspectionDraft(): InspectionDraftContextValue {
  const value = useContext(InspectionDraftContext);
  if (value === null) {
    throw new Error('useInspectionDraft precisa estar dentro de InspectionDraftProvider.');
  }
  return value;
}
