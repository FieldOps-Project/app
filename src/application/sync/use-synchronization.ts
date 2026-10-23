import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { refreshInspections, type RefreshOutcome } from '@/application/sync/refresh-inspections';
import { synchronize, type SyncOutcome } from '@/application/sync/synchronize';
import { mobileInspectionsGateway, queryKeys, type ApiFailure } from '@/infrastructure/api';

/** Local reads depend on what a run wrote; they reload, the device stays the source. */
function invalidateLocalReads(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.synchronization.pending() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.synchronization.lastRun() }),
  ]).then(() => undefined);
}

/**
 * The download of the technician's inspections, run when a screen that lists
 * them opens and again on demand.
 *
 * Its failure is reported on its own and never replaces the stored list: the
 * screen keeps showing what the device has and warns that the update failed
 * (AC-MOBILE-LIST). `network` means offline — a normal state, not an error.
 */
export function useInspectionsDownload() {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useQuery<RefreshOutcome, ApiFailure>({
    queryKey: [...queryKeys.synchronization.all(), 'download', ownerUserId],
    queryFn: async () => {
      const result = await refreshInspections(ownerUserId, mobileInspectionsGateway);
      if (!result.ok) {
        throw result.error;
      }
      await invalidateLocalReads(queryClient);
      return result.value;
    },
    enabled: ownerUserId !== '',
    retry: 0,
  });
}

/** Sends what is pending and downloads again: the "Sincronizar" action. */
export function useSynchronize() {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useMutation<SyncOutcome, ApiFailure>({
    mutationFn: async () => {
      const result = await synchronize(ownerUserId, mobileInspectionsGateway);
      if (!result.ok) {
        throw result.error;
      }
      return result.value;
    },
    onSettled: () => invalidateLocalReads(queryClient),
  });
}
