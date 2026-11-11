import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface InspectionDraftContextValue {
  focusedItemFor: (inspectionId: string) => string | null;
  focusItem: (inspectionId: string, itemId: string) => void;
}

const InspectionDraftContext = createContext<InspectionDraftContextValue | null>(null);

export function InspectionDraftProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState<Record<string, string>>({});

  const focusItem = useCallback((inspectionId: string, itemId: string) => {
    setFocused((current) =>
      current[inspectionId] === itemId ? current : { ...current, [inspectionId]: itemId }
    );
  }, []);

  const focusedItemFor = useCallback(
    (inspectionId: string) => focused[inspectionId] ?? null,
    [focused]
  );

  const value = useMemo<InspectionDraftContextValue>(
    () => ({ focusedItemFor, focusItem }),
    [focusedItemFor, focusItem]
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
