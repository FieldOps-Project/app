import { z } from 'zod';

import { fail, ok, type Result } from '@/domain/result';
import {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type MobileInspectionsGateway,
  type PresentableApiFailure,
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
import { pullChanges, type PullOutcome } from '@/application/sync/pull-changes';
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
  z.object({ action: z.literal('REOPEN'), reopenedAtDevice: z.string() }),
]);

const responsePayloadSchema = z.object({
  id: z.string(),
  inspectionItemId: z.string(),
  valueText: z.string().nullable(),
  valueNumber: z.number().nullable(),
  valueBoolean: z.boolean().nullable(),
  valueDate: z.string().nullable(),
  conformity: z.string().nullable(),
  observation: z.string().nullable(),
  answeredAtDevice: z.string(),
});

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
  readonly pull: PullOutcome | null;
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
      const payload = responsePayloadSchema.safeParse(operation.payload);
      if (!payload.success) {
        return invalidOperation();
      }
      const baseVersion = await findResponseBaseVersion(operation.entityId);
      const saved = await gateway.putResponse(operation.inspectionId, {
        ...payload.data,
        baseVersion,
      });
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
      switch (step.action) {
        case 'START':
          return gateway.start(operation.inspectionId, {
            startedAtDevice: step.startedAtDevice,
            location: step.location,
          });
        case 'SUBMIT':
          return gateway.submit(operation.inspectionId, {
            completedAtDevice: step.completedAtDevice,
            location: step.location,
          });
        case 'REOPEN':
          return gateway.reopen(operation.inspectionId);
      }
    }
  }
}

function isUpload(operation: QueuedOperation): boolean {
  return operation.entityType === 'EVIDENCE' && operation.operationType === 'UPLOAD';
}

type TransitionAction = z.infer<typeof transitionPayloadSchema>['action'];

const APPLIED_STATUSES: Readonly<Record<TransitionAction, readonly string[]>> = {
  START: ['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  SUBMIT: ['SUBMITTED', 'APPROVED'],
  REOPEN: ['IN_PROGRESS'],
};

const MAX_SERVER_FAILURES_PER_RUN = 2;

function transitionAction(operation: QueuedOperation): TransitionAction | null {
  if (operation.entityType !== 'INSPECTION') {
    return null;
  }
  const parsed = transitionPayloadSchema.safeParse(operation.payload);
  return parsed.success ? parsed.data.action : null;
}

function isSubmit(operation: QueuedOperation): boolean {
  return transitionAction(operation) === 'SUBMIT';
}

async function appliedOnServer(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<boolean> {
  const action = transitionAction(operation);
  if (action === null) {
    return false;
  }
  const current = await gateway.detail(operation.inspectionId);
  return current.ok && APPLIED_STATUSES[action].includes(current.value.status);
}

interface Drain {
  readonly sent: number;
  readonly refused: number;
  readonly conflicted: number;
}

interface Queue {
  readonly all: readonly QueuedOperation[];
  readonly open: Set<string>;
  readonly waiting: Map<string, QueuedOperation>;
}

async function recordRefusal(
  operation: QueuedOperation,
  failure: PresentableApiFailure,
  queue: Queue,
  now: () => string
): Promise<void> {
  const reason = describeApiFailure(failure);
  if (failure.kind === 'business' && isSubmit(operation)) {
    await reopenAfterRefusedSubmit(operation, reason, now());
    return;
  }

  await markFailed(operation, failure.kind === 'conflict' ? 'CONFLICT' : 'FAILED', reason, now());
  const completion = queue.all.find(
    (candidate) =>
      candidate.inspectionId === operation.inspectionId &&
      isSubmit(candidate) &&
      queue.open.has(candidate.operationId)
  );
  if (failure.kind === 'business' && isUpload(operation) && completion !== undefined) {
    await reopenAfterRefusedSubmit(completion, reason, now());
    queue.open.delete(completion.operationId);
    queue.waiting.delete(completion.operationId);
  }
}

async function drainQueue(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string
): Promise<Result<Drain, ApiFailure>> {
  const all = await listOpenOperations(ownerUserId);
  const queue: Queue = {
    all,
    open: new Set(all.map((operation) => operation.operationId)),
    waiting: new Map(all.map((operation) => [operation.operationId, operation])),
  };
  const held = new Set<string>();
  const conflicted = new Set<string>();
  let sent = 0;
  let refused = 0;
  let serverFailures = 0;
  let progressed = true;

  while (progressed) {
    progressed = false;

    for (const listed of [...queue.waiting.values()]) {
      if (listed.status === 'CONFLICT') {
        held.add(listed.inspectionId);
        conflicted.add(listed.inspectionId);
        queue.waiting.delete(listed.operationId);
        continue;
      }
      if (held.has(listed.inspectionId)) {
        queue.waiting.delete(listed.operationId);
        continue;
      }
      if (listed.dependencyIds.some((id) => queue.open.has(id))) {
        continue;
      }

      queue.waiting.delete(listed.operationId);
      progressed = true;
      const operation = await claimOperation(listed.operationId, now());
      if (operation === null) {
        continue;
      }
      const result = await send(gateway, operation);

      if (result.ok) {
        await markCompleted(operation, now());
        queue.open.delete(operation.operationId);
        sent += 1;
        continue;
      }

      const failure = result.error;
      if (isNetworkFailure(failure) || failure.kind === 'unauthorized') {
        await releaseOperation(operation.operationId, now());
        return fail(failure);
      }
      if (failure.kind === 'business' && (await appliedOnServer(gateway, operation))) {
        await markCompleted(operation, now());
        queue.open.delete(operation.operationId);
        sent += 1;
        continue;
      }

      await recordRefusal(operation, failure, queue, now);
      held.add(operation.inspectionId);
      refused += 1;

      if (failure.kind === 'server') {
        serverFailures += 1;
        if (serverFailures >= MAX_SERVER_FAILURES_PER_RUN) {
          return fail(failure);
        }
      }
    }
  }

  return ok({ sent, refused, conflicted: conflicted.size });
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

  const drained = await drainQueue(ownerUserId, gateway, now);
  if (!drained.ok) {
    await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
    return drained;
  }
  const { sent, refused, conflicted } = drained.value;

  const refresh = await refreshInspections(ownerUserId, gateway, now);
  if (!refresh.ok) {
    await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
    return refresh;
  }

  const pulled = await pullChanges(ownerUserId, gateway, now);
  if (!pulled.ok && (isNetworkFailure(pulled.error) || pulled.error.kind === 'unauthorized')) {
    await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
    return fail(pulled.error);
  }

  const pull = pulled.ok ? pulled.value : null;
  const partial =
    refused > 0 ||
    conflicted > 0 ||
    refresh.value.failed > 0 ||
    pull === null ||
    pull.held ||
    pull.conflicts > 0;
  await recordSyncRun(ownerUserId, partial ? 'PARTIAL' : 'SUCCESS', startedAt, now());
  return ok({ sent, refused, refresh: refresh.value, pull });
}
