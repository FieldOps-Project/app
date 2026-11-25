import { z } from 'zod';

import { fail, ok, type Result } from '@/domain/result';
import {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type MobileInspectionsGateway,
  type ResponsePayload,
} from '@/infrastructure/api';
import { deleteFile, evidenceUploadUri } from '@/infrastructure/evidence/photo-storage';
import {
  findEvidenceFile,
  findResponseBaseVersion,
  recordResponseVersion,
  recordSyncRun,
} from '@/infrastructure/repositories/inspection-repository';
import {
  claimOperation,
  listOpenOperations,
  markCompleted,
  markFailed,
  releaseInterruptedOperations,
  releaseOperation,
  reopenAfterRefusedSubmit,
  type QueuedOperation,
} from '@/infrastructure/repositories/outbox-repository';
import { refreshInspections, type RefreshOutcome } from '@/application/sync/refresh-inspections';

const locationSchema = z
  .object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().nullable(),
    capturedAt: z.string(),
  })
  .nullable();

const transitionPayloadSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('START'), startedAtDevice: z.string(), location: locationSchema }),
  z.object({
    action: z.literal('SUBMIT'),
    completedAtDevice: z.string(),
    location: locationSchema,
  }),
]);

const nonConformityPayloadSchema = z.object({
  id: z.string(),
  inspectionItemId: z.string().nullable(),
  responseId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  severity: z.string(),
  createdAtDevice: z.string(),
});

const evidencePayloadSchema = z.object({
  id: z.string(),
  inspectionItemId: z.string().nullable(),
  responseId: z.string().nullable(),
  nonConformityId: z.string().nullable().default(null),
  description: z.string().nullable(),
  capturedAtDevice: z.string(),
});

const deletionPayloadSchema = z.object({ id: z.string() });

export interface SyncOutcome {
  readonly sent: number;
  readonly refused: number;
  readonly refresh: RefreshOutcome;
}

function invalidOperation(): Result<void, ApiFailure> {
  return fail({
    kind: 'business',
    code: 'LOCAL_OPERATION_INVALID',
    message: 'Operação local inválida.',
  });
}

async function sendEvidence(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<Result<void, ApiFailure>> {
  if (operation.operationType === 'DELETE_LOGICAL') {
    const removal = deletionPayloadSchema.safeParse(operation.payload);
    if (!removal.success) {
      return invalidOperation();
    }
    const stored = await findEvidenceFile(removal.data.id);
    const outcome = await gateway.deleteEvidence(removal.data.id);
    const result: Result<void, ApiFailure> =
      !outcome.ok && outcome.error.kind === 'notFound' ? ok(undefined) : outcome;
    if (result.ok && stored !== null) {
      deleteFile(stored.photoPath);
      deleteFile(stored.thumbnailPath);
    }
    return result;
  }

  const upload = evidencePayloadSchema.safeParse(operation.payload);
  if (!upload.success) {
    return invalidOperation();
  }
  const stored = await findEvidenceFile(upload.data.id);
  const fileUri = stored?.photoPath == null ? null : evidenceUploadUri(stored.photoPath);
  if (fileUri === null) {
    return fail({
      kind: 'business',
      code: 'LOCAL_FILE_MISSING',
      message: 'O arquivo da foto não está mais neste aparelho.',
    });
  }
  return gateway.uploadEvidence(operation.inspectionId, {
    metadata: {
      id: upload.data.id,
      responseId: upload.data.responseId,
      nonConformityId: upload.data.nonConformityId,
      type: 'PHOTO',
      capturedAtDevice: upload.data.capturedAtDevice,
      description: upload.data.description,
    },
    fileUri,
    mimeType: stored?.mimeType ?? 'image/jpeg',
  });
}

async function send(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<Result<void, ApiFailure>> {
  switch (operation.entityType) {
    case 'RESPONSE': {
      const payload = operation.payload as ResponsePayload;
      const baseVersion = await findResponseBaseVersion(operation.entityId);
      const saved = await gateway.putResponse(operation.inspectionId, { ...payload, baseVersion });
      if (!saved.ok) {
        return saved;
      }
      await recordResponseVersion(operation.entityId, saved.value);
      return ok(undefined);
    }
    case 'NON_CONFORMITY': {
      const created = nonConformityPayloadSchema.safeParse(operation.payload);
      return created.success
        ? gateway.createNonConformity(operation.inspectionId, created.data)
        : invalidOperation();
    }
    case 'EVIDENCE':
      return sendEvidence(gateway, operation);
    case 'INSPECTION': {
      const transition = transitionPayloadSchema.safeParse(operation.payload);
      if (!transition.success) {
        return invalidOperation();
      }
      const step = transition.data;
      return step.action === 'START'
        ? gateway.start(operation.inspectionId, {
            startedAtDevice: step.startedAtDevice,
            location: step.location,
          })
        : gateway.submit(operation.inspectionId, {
            completedAtDevice: step.completedAtDevice,
            location: step.location,
          });
    }
  }
}

function isUpload(operation: QueuedOperation): boolean {
  return operation.entityType === 'EVIDENCE' && operation.operationType === 'UPLOAD';
}

function isSubmit(operation: QueuedOperation): boolean {
  return (
    operation.entityType === 'INSPECTION' &&
    (operation.payload as { action?: unknown } | null)?.action === 'SUBMIT'
  );
}

let running: Promise<Result<SyncOutcome, ApiFailure>> | null = null;

export function synchronize(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string = () => new Date().toISOString()
): Promise<Result<SyncOutcome, ApiFailure>> {
  running ??= run(ownerUserId, gateway, now).finally(() => {
    running = null;
  });
  return running;
}

async function run(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string
): Promise<Result<SyncOutcome, ApiFailure>> {
  const startedAt = now();
  await releaseInterruptedOperations(ownerUserId, startedAt);

  const queue = await listOpenOperations(ownerUserId);
  const open = new Set(queue.map((operation) => operation.operationId));
  const held = new Set<string>();
  let sent = 0;
  let refused = 0;

  const waiting = new Map(queue.map((operation) => [operation.operationId, operation]));
  let progressed = true;

  while (progressed) {
    progressed = false;

    for (const listed of [...waiting.values()]) {
      if (listed.status === 'CONFLICT') {
        held.add(listed.inspectionId);
        waiting.delete(listed.operationId);
        continue;
      }
      if (held.has(listed.inspectionId)) {
        waiting.delete(listed.operationId);
        continue;
      }
      if (listed.dependencyIds.some((id) => open.has(id))) {
        continue;
      }

      waiting.delete(listed.operationId);
      progressed = true;
      const operation = await claimOperation(listed.operationId, now());
      if (operation === null) {
        continue;
      }
      const result = await send(gateway, operation);

      if (result.ok) {
        await markCompleted(operation, now());
        open.delete(operation.operationId);
        sent += 1;
        continue;
      }

      const failure = result.error;
      if (isNetworkFailure(failure) || failure.kind === 'unauthorized') {
        await releaseOperation(operation.operationId, now());
        await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
        return fail(failure);
      }

      const reason = describeApiFailure(failure);
      if (failure.kind === 'business' && isSubmit(operation)) {
        await reopenAfterRefusedSubmit(operation, reason, now());
      } else {
        await markFailed(
          operation,
          failure.kind === 'conflict' ? 'CONFLICT' : 'FAILED',
          reason,
          now()
        );
        const completion = queue.find(
          (candidate) =>
            candidate.inspectionId === operation.inspectionId &&
            isSubmit(candidate) &&
            open.has(candidate.operationId)
        );
        if (failure.kind === 'business' && isUpload(operation) && completion !== undefined) {
          await reopenAfterRefusedSubmit(completion, reason, now());
          open.delete(completion.operationId);
          waiting.delete(completion.operationId);
        }
      }
      held.add(operation.inspectionId);
      refused += 1;
    }
  }
  const refresh = await refreshInspections(ownerUserId, gateway, now);
  if (!refresh.ok) {
    await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
    return refresh;
  }

  const partial = refused > 0 || refresh.value.failed > 0;
  await recordSyncRun(ownerUserId, partial ? 'PARTIAL' : 'SUCCESS', startedAt, now());
  return ok({ sent, refused, refresh: refresh.value });
}
