import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/application/session/session-context';
import type { InspectionSummary } from '@/domain/inspection';
import { queryKeys } from '@/infrastructure/api';
import {
  findInspection,
  listInspectionSummaries,
  readLastSuccessfulSync,
  type StoredInspection,
} from '@/infrastructure/repositories/inspection-repository';
import { countOpenOperations } from '@/infrastructure/repositories/outbox-repository';

/**
 * Read side of the inspections, served from the device (document 13.6).
 *
 * Screens call these hooks and never the repositories: when the source
 * changes, only this file does (card #9). Each read is scoped to the signed-in
 * technician (RN-004).
 */

/** The signed-in technician; empty while the session is being torn down. */
export function useOwnerUserId(): string {
  const { session } = useSession();
  return session?.userId ?? '';
}

export function useInspectionSummaries() {
  const ownerUserId = useOwnerUserId();
  return useQuery<InspectionSummary[], Error>({
    queryKey: queryKeys.inspections.list({ ownerUserId }),
    queryFn: () => listInspectionSummaries(ownerUserId),
    enabled: ownerUserId !== '',
    staleTime: Infinity,
  });
}

export function useStoredInspection(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  return useQuery<StoredInspection | null, Error>({
    queryKey: queryKeys.inspections.detail(inspectionId),
    queryFn: () => findInspection(ownerUserId, inspectionId),
    enabled: ownerUserId !== '' && inspectionId !== '',
    staleTime: Infinity,
  });
}

/** RN-071: operations still owed to the server. */
export function usePendingOperationsCount() {
  const ownerUserId = useOwnerUserId();
  return useQuery<number, Error>({
    queryKey: queryKeys.synchronization.pending(),
    queryFn: () => countOpenOperations(ownerUserId),
    enabled: ownerUserId !== '',
    staleTime: Infinity,
  });
}

export function useLastSuccessfulSync() {
  const ownerUserId = useOwnerUserId();
  return useQuery<string | null, Error>({
    queryKey: queryKeys.synchronization.lastRun(),
    queryFn: () => readLastSuccessfulSync(ownerUserId),
    enabled: ownerUserId !== '',
    staleTime: Infinity,
  });
}
