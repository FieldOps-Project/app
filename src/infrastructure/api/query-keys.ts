export const queryKeys = {
  health: () => ['api', 'health'] as const,

  inspections: {
    all: () => ['inspections'] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.inspections.all(), 'list', filters ?? {}] as const,
    detail: (ownerUserId: string, inspectionId: string) =>
      [...queryKeys.inspections.all(), 'detail', ownerUserId, inspectionId] as const,
  },

  synchronization: {
    all: () => ['synchronization'] as const,
    pending: (ownerUserId: string) =>
      [...queryKeys.synchronization.all(), 'pending', ownerUserId] as const,
    lastRun: (ownerUserId: string) =>
      [...queryKeys.synchronization.all(), 'last-run', ownerUserId] as const,
    download: (ownerUserId: string) =>
      [...queryKeys.synchronization.all(), 'download', ownerUserId] as const,
  },
} as const;
