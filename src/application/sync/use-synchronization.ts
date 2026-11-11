import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { refreshInspections, type RefreshOutcome } from '@/application/sync/refresh-inspections';
import { synchronize, type SyncOutcome } from '@/application/sync/synchronize';
import { mobileInspectionsGateway, queryKeys, type ApiFailure } from '@/infrastructure/api';

function invalidateLocalReads(queryClient: QueryClient, ownerUserId: string): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.synchronization.pending(ownerUserId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.synchronization.lastRun(ownerUserId) }),
  ]).then(() => undefined);
}

export function useInspectionsDownload() {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useQuery<RefreshOutcome, ApiFailure>({
    queryKey: queryKeys.synchronization.download(ownerUserId),
    queryFn: async () => {
      const result = await refreshInspections(ownerUserId, mobileInspectionsGateway);
      if (!result.ok) {
        throw result.error;
      }
      await invalidateLocalReads(queryClient, ownerUserId);
      return result.value;
    },
    enabled: ownerUserId !== '',
    retry: 0,
  });
}

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
    onSettled: () => invalidateLocalReads(queryClient, ownerUserId),
  });
}
