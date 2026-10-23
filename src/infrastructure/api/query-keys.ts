/**
 * The single source of truth for TanStack Query keys.
 *
 * Every remote query and every invalidation builds its key here, so keys never
 * drift between call sites: a mutation invalidates `queryKeys.inspections.all()`
 * and every list and detail nested under it refetches. Keys are declared
 * hierarchically (`['inspections'] → ['inspections','detail', id]`) precisely so
 * this prefix-invalidation works.
 *
 * Inspections are read from SQLite, the operational source (document 13.6),
 * through these same keys: Query caches the local read and the writes
 * invalidate it, so every screen sees a change the moment it is saved.
 */
export const queryKeys = {
  /** Liveness probe: tells "server unreachable" apart from "server erroring". */
  health: () => ['api', 'health'] as const,

  inspections: {
    all: () => ['inspections'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.inspections.all(), 'list', filters ?? {}] as const,
    detail: (inspectionId: string) =>
      [...queryKeys.inspections.all(), 'detail', inspectionId] as const,
  },

  synchronization: {
    all: () => ['synchronization'] as const,
    /** Operations still owed to the server (RN-071). */
    pending: () => [...queryKeys.synchronization.all(), 'pending'] as const,
    lastRun: () => [...queryKeys.synchronization.all(), 'last-run'] as const,
  },
} as const;
