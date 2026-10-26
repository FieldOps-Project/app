import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import type { LocationCapture } from '@/domain/field-location';
import { queryKeys } from '@/infrastructure/api';
import { newId } from '@/infrastructure/ids';
import { captureLocation } from '@/infrastructure/location/capture-location';
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
 * Each transition reads the position once (card #19, RN-060). The clock is
 * taken at the confirmation, before the reading, so a slow fix does not move
 * the moment of the action; a missing position never stops the transition —
 * it is saved with the reason, and the outcome tells the screen.
 */
function useTransition(
  run: (
    ownerUserId: string,
    operationId: string,
    deviceTime: string,
    location: LocationCapture
  ) => Promise<void>
) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();
  const [locating, setLocating] = useState(false);

  const mutation = useMutation<LocationCapture, Error>({
    mutationFn: async () => {
      const deviceTime = new Date().toISOString();
      setLocating(true);
      const location = await captureLocation().finally(() => setLocating(false));
      await run(ownerUserId, newId(), deviceTime, location);
      return location;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.inspections.all() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.synchronization.pending(ownerUserId),
        }),
      ]),
  });

  /** `locating` is the part of `isPending` spent waiting for the position. */
  return { ...mutation, locating };
}

/** UC-09: ASSIGNED → IN_PROGRESS on the device. */
export function useStartInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, startedAtDevice, location) =>
    startInspection({ ownerUserId, inspectionId, operationId, startedAtDevice, location })
  );
}

/**
 * UC-13: the local completion. The screen only offers it with nothing pending
 * (RN-037, RN-038, RN-039); the repository refuses it outside IN_PROGRESS,
 * and the server validates everything again on submit.
 */
export function useCompleteInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, completedAtDevice, location) =>
    completeInspection({ ownerUserId, inspectionId, operationId, completedAtDevice, location })
  );
}
