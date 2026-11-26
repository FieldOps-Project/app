import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { queryKeys } from '@/infrastructure/api';
import { recordEquipmentDivergence } from '@/infrastructure/repositories/inspection-repository';

export interface DivergenceInput {
  readonly scannedEquipmentId: string;
  readonly scannedEquipmentName: string;
}

export function useRecordEquipmentDivergence(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useMutation<void, Error, DivergenceInput>({
    mutationFn: (input) =>
      recordEquipmentDivergence({
        ownerUserId,
        inspectionId,
        ...input,
        recordedAt: new Date().toISOString(),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() }),
  });
}
