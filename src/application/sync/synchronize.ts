import { z } from 'zod';

import { fail, ok, type Result } from '@/domain/result';
import {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type MobileInspectionsGateway,
  type ResponsePayload,
} from '@/infrastructure/api';
import { recordSyncRun } from '@/infrastructure/repositories/inspection-repository';
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

export interface SyncOutcome {
  readonly sent: number;
  readonly refused: number;
  readonly refresh: RefreshOutcome;
}

function send(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<Result<void, ApiFailure>> {
  if (operation.entityType === 'RESPONSE') {
    return gateway.putResponse(operation.inspectionId, operation.payload as ResponsePayload);
  }

  const transition = transitionPayloadSchema.safeParse(operation.payload);
  if (!transition.success) {
    return Promise.resolve(
      fail({
        kind: 'business',
        code: 'LOCAL_OPERATION_INVALID',
        message: 'Operação local inválida.',
      })
    );
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

function canSendYet(operation: QueuedOperation): boolean {
  return operation.entityType === 'INSPECTION' || operation.entityType === 'RESPONSE';
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
    if (!canSendYet(listed)) {
      continue;
    }
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
