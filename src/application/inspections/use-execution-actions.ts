import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import { queryKeys } from '@/infrastructure/api';
import { newId } from '@/infrastructure/ids';
import {
  completeInspection,
  startInspection,
} from '@/infrastructure/repositories/inspection-repository';

/**
 * State transitions done in the field (UC-09, UC-13). Both run entirely on the
 * device: the device clock is recorded as the real moment of the action
 * (RN-034, RN-042), the change and its outbox operation are saved together,
 * and the server learns about it on the next synchronization.
 *
 * Location is `null` until point capture arrives with card #19; the start and
 * the completion never wait for it.
 */
function useTransition(
  run: (ownerUserId: string, operationId: string, deviceTime: string) => Promise<void>
) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useMutation<void, Error>({
    mutationFn: () => run(ownerUserId, newId(), new Date().toISOString()),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.synchronization.pending(ownerUserId),
        }),
      ]),
  });
}

/** UC-09: ASSIGNED → IN_PROGRESS on the device. */
export function useStartInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, startedAtDevice) =>
    startInspection({ ownerUserId, inspectionId, operationId, startedAtDevice, location: null })
  );
}

/**
 * UC-13: the local completion. The screen only offers it with nothing pending
 * (RN-037, RN-038, RN-039); the repository refuses it outside IN_PROGRESS,
 * and the server validates everything again on submit.
 */
export function useCompleteInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, completedAtDevice) =>
    completeInspection({
      ownerUserId,
      inspectionId,
      operationId,
      completedAtDevice,
      location: null,
    })
  );
}
