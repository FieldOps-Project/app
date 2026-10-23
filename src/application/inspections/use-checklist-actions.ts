import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import type { ChecklistResponse } from '@/domain/checklist';
import { queryKeys } from '@/infrastructure/api';
import { newId } from '@/infrastructure/ids';
import {
  registerEvidence,
  saveResponse,
  type StoredInspection,
} from '@/infrastructure/repositories/inspection-repository';
import type { ResponseFormOutput } from '@/schemas/checklist-response';

/**
 * Saves one confirmed answer on the device (RN-041, document 10.14.2).
 *
 * The cached inspection is patched in place before the write: only the
 * answered item's response changes identity, so the other rows of a long
 * checklist do not re-render, and the progress recomputes once per confirmed
 * answer rather than per keystroke (cards #12 and #15). Nothing waits for the
 * network. A refused write — the inspection was completed meanwhile — rolls
 * the cache back to what the device holds.
 *
 * The response is built once, before the write, so the cache and the device
 * agree on its id from the start.
 */
export function useSaveAnswer(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();
  const detailKey = queryKeys.inspections.detail(ownerUserId, inspectionId);

  const mutation = useMutation<
    void,
    Error,
    ChecklistResponse,
    { previous: StoredInspection | null | undefined }
  >({
    mutationFn: (response) =>
      saveResponse({ ownerUserId, inspectionId, operationId: newId(), response }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData<StoredInspection | null>(detailKey);
      if (previous != null) {
        const exists = previous.responses.some(
          (response) => response.inspectionItemId === next.inspectionItemId
        );
        queryClient.setQueryData<StoredInspection>(detailKey, {
          ...previous,
          detail: { ...previous.detail, syncState: 'aguardando-envio' },
          responses: exists
            ? previous.responses.map((response) =>
                response.inspectionItemId === next.inspectionItemId ? next : response
              )
            : [...previous.responses, next],
        });
      }
      return { previous };
    },
    onError: (_error, _response, context) => {
      queryClient.setQueryData(detailKey, context?.previous);
      void queryClient.invalidateQueries({ queryKey: detailKey });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inspections.list({ ownerUserId }) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.synchronization.pending(ownerUserId),
      });
    },
  });

  const save = (inspectionItemId: string, answer: ResponseFormOutput) => {
    const stored = queryClient.getQueryData<StoredInspection | null>(detailKey);
    const current = stored?.responses.find(
      (response) => response.inspectionItemId === inspectionItemId
    );
    mutation.mutate(toResponse(inspectionItemId, answer, current));
  };

  return { save, error: mutation.error, reset: mutation.reset };
}

function toResponse(
  inspectionItemId: string,
  { columns, observation }: ResponseFormOutput,
  current: ChecklistResponse | undefined
): ChecklistResponse {
  return {
    id: current?.id ?? newId(),
    inspectionItemId,
    ...columns,
    observation,
    answeredAtDevice: new Date().toISOString(),
  };
}

/**
 * Records that an evidence was attached to an item, so RN-039 can be
 * checked. The photo file and its upload arrive with the camera (card #17).
 */
export function useRegisterEvidence(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { inspectionItemId: string }>({
    mutationFn: ({ inspectionItemId }) =>
      registerEvidence({
        ownerUserId,
        inspectionId,
        inspectionItemId,
        evidenceId: newId(),
        createdAtDevice: new Date().toISOString(),
      }),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.inspections.detail(ownerUserId, inspectionId),
      }),
  });
}
