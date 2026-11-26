import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/application/session/session-context';
import type { InspectionSummary } from '@/domain/inspection';
import { queryKeys } from '@/infrastructure/api';
import {
  findInspection,
  listInspectionSummaries,
  readLastSync,
  type LastSync,
  type StoredInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  listConflicts,
  type ConflictingRecord,
} from '@/infrastructure/repositories/conflict-repository';
import { countOpenOperations } from '@/infrastructure/repositories/outbox-repository';

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
    queryKey: queryKeys.inspections.detail(ownerUserId, inspectionId),
    queryFn: () => findInspection(ownerUserId, inspectionId),
    enabled: ownerUserId !== '' && inspectionId !== '',
    staleTime: Infinity,
  });
}

export function usePendingOperationsCount() {
  const ownerUserId = useOwnerUserId();
  return useQuery<number, Error>({
    queryKey: queryKeys.synchronization.pending(ownerUserId),
    queryFn: () => countOpenOperations(ownerUserId),
    enabled: ownerUserId !== '',
    staleTime: Infinity,
  });
}

export function useLastSync() {
  const ownerUserId = useOwnerUserId();
  return useQuery<LastSync, Error>({
    queryKey: queryKeys.synchronization.lastRun(ownerUserId),
    queryFn: () => readLastSync(ownerUserId),
    enabled: ownerUserId !== '',
    staleTime: Infinity,
  });
}

export function useInspectionConflicts(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  return useQuery<ConflictingRecord[], Error>({
    queryKey: queryKeys.synchronization.conflicts(ownerUserId, inspectionId),
    queryFn: () => listConflicts(ownerUserId, inspectionId),
    enabled: ownerUserId !== '' && inspectionId !== '',
    staleTime: Infinity,
  });
}
