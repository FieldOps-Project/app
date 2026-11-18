import { z } from 'zod';

import { fail, ok, type Result } from '@/domain/result';
import {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type MobileInspectionsGateway,
  type ResponsePayload,
} from '@/infrastructure/api';
import { readEvidenceFile, deleteFile } from '@/infrastructure/evidence/photo-storage';
import {
  findEvidenceFile,
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
  status: z.string(),
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
    const result = await gateway.deleteEvidence(removal.data.id);
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
  const file = stored?.photoPath == null ? null : readEvidenceFile(stored.photoPath);
  if (file === null) {
    return fail({
      kind: 'business',
      code: 'LOCAL_FILE_MISSING',
      message: 'O arquivo da foto não está mais neste aparelho.',
    });
  }
  return gateway.uploadEvidence(operation.inspectionId, {
    metadata: { ...upload.data, type: 'PHOTO' },
    file,
    mimeType: stored?.mimeType ?? 'image/jpeg',
  });
}

async function send(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<Result<void, ApiFailure>> {
  switch (operation.entityType) {
    case 'RESPONSE':
      return gateway.putResponse(operation.inspectionId, operation.payload as ResponsePayload);
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

  for (const listed of queue) {
    if (listed.status === 'CONFLICT') {
      held.add(listed.inspectionId);
      continue;
    }
    if (held.has(listed.inspectionId) || listed.dependencyIds.some((id) => open.has(id))) {
      held.add(listed.inspectionId);
      continue;
    }

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
    }
    held.add(operation.inspectionId);
    refused += 1;
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
