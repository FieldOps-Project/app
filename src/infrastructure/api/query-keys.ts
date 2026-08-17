/**
 * The single source of truth for TanStack Query keys.
 *
 * Every remote query and every invalidation builds its key here, so keys never
 * drift between call sites: a mutation invalidates `queryKeys.inspections.all()`
 * and every list and detail nested under it refetches. Keys are declared
 * hierarchically (`['inspections'] → ['inspections','detail', id]`) precisely so
 * this prefix-invalidation works.
 *
 * From sprint 6 SQLite becomes the operational source (document 13.6) and Query
 * is left with only what is genuinely remote; keeping the keys in one file makes
 * that remote surface easy to see and to prune.
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
} as const;
