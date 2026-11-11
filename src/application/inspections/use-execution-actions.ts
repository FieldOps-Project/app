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

  return { ...mutation, locating };
}

export function useStartInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, startedAtDevice, location) =>
    startInspection({ ownerUserId, inspectionId, operationId, startedAtDevice, location })
  );
}

export function useCompleteInspection(inspectionId: string) {
  return useTransition((ownerUserId, operationId, completedAtDevice, location) =>
    completeInspection({ ownerUserId, inspectionId, operationId, completedAtDevice, location })
  );
}
