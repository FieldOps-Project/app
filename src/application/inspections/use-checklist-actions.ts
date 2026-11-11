import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useOwnerUserId } from '@/application/inspections/use-inspections';
import type { ChecklistResponse } from '@/domain/checklist';
import { normalizeDescription } from '@/domain/evidence';
import { queryKeys } from '@/infrastructure/api';
import { newId } from '@/infrastructure/ids';
import {
  deleteFile,
  storePhoto,
  type CapturedPhoto,
  type StorePhotoFailure,
} from '@/infrastructure/evidence/photo-storage';
import {
  discardEvidence,
  InspectionStateError,
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
    /**
     * Re-reads the inspection once the write is on the device, so a read that
     * raced with it cannot leave the screen on the older answer. Structural
     * sharing keeps every unchanged response object, so the rows stay put.
     */
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detailKey });
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

export class EvidenceError extends Error {
  constructor(readonly failure: StorePhotoFailure) {
    super(describeEvidenceFailure(failure));
    this.name = 'EvidenceError';
  }
}

function describeEvidenceFailure(failure: StorePhotoFailure): string {
  if (failure.kind === 'storage') {
    return 'Não foi possível guardar a foto no aparelho. Verifique o espaço livre e tente de novo.';
  }
  switch (failure.reason) {
    case 'TOO_LARGE':
      return 'A foto ficou maior que o permitido. Fotografe de novo.';
    case 'UNSUPPORTED_TYPE':
      return 'Formato de imagem não aceito. Fotografe de novo.';
    case 'EMPTY':
      return 'A foto veio vazia. Fotografe de novo.';
  }
}

export interface AttachPhotoInput {
  readonly inspectionItemId: string;
  readonly photo: CapturedPhoto;
  readonly description: string;
}

function useInvalidateInspection(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.inspections.detail(ownerUserId, inspectionId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.inspections.list({ ownerUserId }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.synchronization.pending(ownerUserId) }),
    ]);
}

/**
 * UC-11: the confirmed photo becomes an evidence of the item. The file is
 * prepared and moved to the persistent directory first, then the evidence
 * and its upload are recorded in one transaction; if that write is refused,
 * the files just stored are removed, so nothing is left without a record, and
 * the camera's file stays for another try. Errors reach the screen already
 * worded for the technician. Nothing waits for the network.
 */
export function useAttachPhoto(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const invalidate = useInvalidateInspection(inspectionId);

  return useMutation<void, Error, AttachPhotoInput>({
    mutationFn: async ({ inspectionItemId, photo, description }) => {
      const evidenceId = newId();
      const stored = await storePhoto(photo, { inspectionId, evidenceId });
      if (!stored.ok) {
        throw new EvidenceError(stored.error);
      }
      try {
        await registerEvidence({
          ownerUserId,
          inspectionId,
          inspectionItemId,
          evidenceId,
          createdAtDevice: new Date().toISOString(),
          file: {
            operationId: newId(),
            photoPath: stored.value.photoPath,
            thumbnailPath: stored.value.thumbnailPath,
            mimeType: stored.value.mimeType,
            sizeBytes: stored.value.sizeBytes,
            description: normalizeDescription(description),
          },
        });
      } catch (error) {
        deleteFile(stored.value.photoPath);
        deleteFile(stored.value.thumbnailPath);
        throw error instanceof InspectionStateError
          ? error
          : new Error('Não foi possível salvar a evidência no aparelho. Tente de novo.');
      }
      deleteFile(photo.uri);
    },
    // Not awaited: the screen leaves as soon as the write is done, and the
    // lists refresh behind it.
    onSettled: () => void invalidate(),
  });
}

/**
 * Removes an evidence. A file never sent is deleted with it; one the server
 * may already hold stays until the removal is confirmed (RN-047).
 */
export function useDiscardEvidence(inspectionId: string) {
  const ownerUserId = useOwnerUserId();
  const invalidate = useInvalidateInspection(inspectionId);

  return useMutation<void, Error, { evidenceId: string }>({
    mutationFn: async ({ evidenceId }) => {
      const outcome = await discardEvidence({
        ownerUserId,
        inspectionId,
        evidenceId,
        operationId: newId(),
        discardedAtDevice: new Date().toISOString(),
      });
      if (outcome.outcome === 'removed') {
        outcome.files.forEach(deleteFile);
      }
    },
    onSettled: () => void invalidate(),
  });
}
