import { useMutation, useQuery } from '@tanstack/react-query';

import { useInvalidateInspection } from '@/application/inspections/use-checklist-actions';
import { useOwnerUserId } from '@/application/inspections/use-inspections';
import type { NonConformity } from '@/domain/non-conformity';
import { queryKeys } from '@/infrastructure/api';
import { deleteFile } from '@/infrastructure/evidence/photo-storage';
import { newId } from '@/infrastructure/ids';
import {
  createNonConformity,
  deleteNonConformity,
  listNonConformities,
  type DeletedNonConformity,
} from '@/infrastructure/repositories/non-conformity-repository';
import type { NonConformityFormOutput } from '@/schemas/non-conformity';

export function useNonConformities(inspectionId: string) {
  const ownerUserId = useOwnerUserId();

  return useQuery<NonConformity[], Error>({
    queryKey: queryKeys.nonConformities.list(ownerUserId, inspectionId),
    queryFn: () => listNonConformities(ownerUserId, inspectionId),
    enabled: ownerUserId !== '' && inspectionId !== '',
  });
}

export interface NewNonConformity {
  readonly inspectionItemId: string;
  readonly form: NonConformityFormOutput;
}

export function useCreateNonConformity(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const invalidate = useInvalidateInspection(inspectionId);

  return useMutation<string, Error, NewNonConformity>({
    mutationFn: async ({ inspectionItemId, form }) => {
      const nonConformityId = newId();
      await createNonConformity({
        ownerUserId,
        inspectionId,
        inspectionItemId,
        nonConformityId,
        operationId: newId(),
        createdAtDevice: new Date().toISOString(),
        title: form.title,
        description: form.description,
        severity: form.severity,
      });
      return nonConformityId;
    },
    onSettled: () => void invalidate(),
  });
}

export function useDeleteNonConformity(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const invalidate = useInvalidateInspection(inspectionId);

  return useMutation<DeletedNonConformity, Error, string>({
    mutationFn: async (nonConformityId) => {
      const result = await deleteNonConformity({
        ownerUserId,
        inspectionId,
        nonConformityId,
        deletedAtDevice: new Date().toISOString(),
      });
      if (result.outcome === 'removed') {
        result.files.forEach(deleteFile);
      }
      return result;
    },
    onSettled: () => void invalidate(),
  });
}
