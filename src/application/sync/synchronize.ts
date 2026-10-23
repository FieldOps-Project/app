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
  listOpenOperations,
  markCompleted,
  markFailed,
  markProcessing,
  releaseOperation,
  type QueuedOperation,
} from '@/infrastructure/repositories/outbox-repository';
import { refreshInspections, type RefreshOutcome } from '@/application/sync/refresh-inspections';

const transitionPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('START'),
    startedAtDevice: z.string(),
    location: z.null(),
  }),
  z.object({
    action: z.literal('SUBMIT'),
    completedAtDevice: z.string(),
    location: z.null(),
  }),
]);

export interface SyncOutcome {
  readonly sent: number;
  /** Operations the server refused; they stay in the queue with their error. */
  readonly refused: number;
  readonly refresh: RefreshOutcome;
}

function send(
  gateway: MobileInspectionsGateway,
  operation: QueuedOperation
): Promise<Result<void, ApiFailure>> {
  if (operation.entityType === 'RESPONSE') {
    // Written by `saveResponse` in this exact shape; the server validates it again.
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

/**
 * Sends the outbox, then downloads (document 10.14.5).
 *
 * Operations go oldest first, one at a time, each with the id it was created
 * with, so a resend is never a duplicate (RN-068). A refusal is recorded on
 * the operation and holds back the rest of that inspection — the submit must
 * not overtake an answer the server rejected — while other inspections carry
 * on (RN-070). Losing the network stops the run and leaves the queue exactly
 * as it was.
 *
 * This is the sprint 4 minimum; batches, explicit dependency ordering and the
 * retry policy are card #24's scope.
 */
export async function synchronize(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string = () => new Date().toISOString()
): Promise<Result<SyncOutcome, ApiFailure>> {
  const startedAt = now();
  const held = new Set<string>();
  let sent = 0;
  let refused = 0;

  for (const operation of await listOpenOperations(ownerUserId)) {
    if (held.has(operation.inspectionId)) {
      continue;
    }

    await markProcessing(operation.operationId, now());
    const result = await send(gateway, operation);

    if (result.ok) {
      await markCompleted(operation, now());
      sent += 1;
      continue;
    }

    const failure = result.error;
    if (isNetworkFailure(failure) || failure.kind === 'unauthorized') {
      await releaseOperation(operation.operationId, now());
      await recordSyncRun(ownerUserId, 'FAILED', startedAt, now());
      return fail(failure);
    }

    await markFailed(
      operation,
      failure.kind === 'conflict' ? 'CONFLICT' : 'FAILED',
      describeApiFailure(failure),
      now()
    );
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
