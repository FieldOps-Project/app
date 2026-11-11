import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';

/**
 * Persistent outbox (document 10.13.3). Every confirmed change on the device
 * becomes, or updates, one operation here; the synchronization reads them in
 * order and sends them with their idempotent id.
 *
 * The queue lives in SQLite, so it outlives closing the app and restarting
 * the phone (RN-066). An operation id is generated once and kept through
 * every retry (RN-067); a failure marks only its own operation (RN-070); an
 * operation declares the ones it must wait for (RN-069). Batching and the
 * retry policy are card #24's scope.
 */

export type OperationEntity = 'INSPECTION' | 'RESPONSE' | 'EVIDENCE' | 'NON_CONFORMITY';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE_LOGICAL' | 'TRANSITION' | 'UPLOAD';

/** Local tables of the records an operation can change, by entity. */
const ENTITY_TABLES: Partial<Record<OperationEntity, string>> = {
  RESPONSE: 'inspection_responses',
  EVIDENCE: 'evidences',
  NON_CONFORMITY: 'non_conformities',
};

const MAX_ERROR_LENGTH = 300;

/**
 * The last line before an error reaches `last_error` and the screens: drops
 * anything shaped like a credential (a bearer token, a JWT, a `token=` or
 * `password=` pair), flattens whitespace and caps the length. Callers already
 * pass business wording; this keeps a careless message from storing a secret.
 */
export function sanitizeSyncError(error: string): string {
  const cleaned = error
    .replace(/bearer\s+[\w.~+/-]+=*/gi, 'Bearer [removido]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[removido]')
    .replace(
      /\b(access_?token|refresh_?token|token|password|senha|secret)\b\s*[:=]\s*("[^"]*"|\S+)/gi,
      '$1=[removido]'
    )
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > MAX_ERROR_LENGTH ? `${cleaned.slice(0, MAX_ERROR_LENGTH - 1)}…` : cleaned;
}

export type OperationStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'CONFLICT' | 'COMPLETED';

export interface NewOperation {
  /** Generated once, here, and never again — retries reuse it (RN-068). */
  readonly operationId: string;
  readonly ownerUserId: string;
  readonly entityType: OperationEntity;
  readonly entityId: string;
  readonly inspectionId: string;
  readonly operationType: OperationType;
  readonly baseVersion: number;
  readonly payload: unknown;
  readonly dependencyIds?: readonly string[];
}

export interface QueuedOperation {
  readonly operationId: string;
  readonly entityType: OperationEntity;
  readonly entityId: string;
  readonly inspectionId: string;
  readonly operationType: OperationType;
  readonly baseVersion: number;
  readonly payload: unknown;
  readonly dependencyIds: readonly string[];
  readonly status: OperationStatus;
  readonly attemptCount: number;
  readonly lastError: string | null;
}

interface OperationRow {
  operation_id: string;
  entity_type: OperationEntity;
  entity_id: string;
  inspection_id: string;
  operation_type: OperationType;
  base_version: number;
  payload_json: string;
  dependency_ids: string;
  status: OperationStatus;
  attempt_count: number;
  last_error: string | null;
}

function toQueuedOperation(row: OperationRow): QueuedOperation {
  return {
    operationId: row.operation_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    inspectionId: row.inspection_id,
    operationType: row.operation_type,
    baseVersion: row.base_version,
    payload: JSON.parse(row.payload_json) as unknown,
    dependencyIds: JSON.parse(row.dependency_ids) as string[],
    status: row.status,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
  };
}

/**
 * Adds an operation, or folds it into the pending one for the same record:
 * editing an answer five times offline sends it once. Only operations at rest
 * are folded: PENDING, or FAILED, whose new payload is the technician's fix
 * and goes back to PENDING. A PROCESSING one may already have reached the
 * server. Only data edits (CREATE, UPDATE) fold, and the folded operation
 * keeps its id and its type; state transitions, uploads and removals are
 * each their own step.
 *
 * Runs on the caller's transaction, so the record and its operation are saved
 * together or not at all.
 */
export async function enqueueOperation(
  transaction: SQLiteDatabase,
  operation: NewOperation,
  now: string
): Promise<void> {
  if (operation.operationType === 'CREATE' || operation.operationType === 'UPDATE') {
    const folded = await transaction.runAsync(
      `UPDATE sync_operations
          SET payload_json = ?, status = 'PENDING', last_error = NULL, updated_at = ?
        WHERE entity_type = ? AND entity_id = ? AND status IN ('PENDING', 'FAILED')
          AND operation_type IN ('CREATE', 'UPDATE')`,
      JSON.stringify(operation.payload),
      now,
      operation.entityType,
      operation.entityId
    );
    if (folded.changes > 0) {
      return;
    }
  }

  await transaction.runAsync(
    `INSERT INTO sync_operations (
       operation_id, owner_user_id, entity_type, entity_id, inspection_id, operation_type,
       base_version, payload_json, dependency_ids, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
    operation.operationId,
    operation.ownerUserId,
    operation.entityType,
    operation.entityId,
    operation.inspectionId,
    operation.operationType,
    operation.baseVersion,
    JSON.stringify(operation.payload),
    JSON.stringify(operation.dependencyIds ?? []),
    now,
    now
  );
}

/** Ids of the operations still owed for an inspection, to declare as dependencies. */
export async function openOperationIds(
  transaction: SQLiteDatabase,
  inspectionId: string
): Promise<string[]> {
  const rows = await transaction.getAllAsync<{ operation_id: string }>(
    `SELECT operation_id FROM sync_operations
      WHERE inspection_id = ? AND status <> 'COMPLETED'
      ORDER BY created_at, rowid`,
    inspectionId
  );
  return rows.map((row) => row.operation_id);
}

/**
 * Ids of the operations still owed for one record — what an upload must wait
 * for when its evidence belongs to an answer not yet created on the server
 * (document 10.13.3).
 */
export async function openOperationIdsFor(
  transaction: SQLiteDatabase,
  entityType: OperationEntity,
  entityId: string
): Promise<string[]> {
  const rows = await transaction.getAllAsync<{ operation_id: string }>(
    `SELECT operation_id FROM sync_operations
      WHERE entity_type = ? AND entity_id = ? AND status <> 'COMPLETED'
      ORDER BY created_at, rowid`,
    entityType,
    entityId
  );
  return rows.map((row) => row.operation_id);
}

/**
 * A record removed on the device before its operations reached the server:
 * those operations leave the queue, so nothing is sent for a record that no
 * longer exists. An operation is known not to have reached the server when it
 * was never attempted, or when the server answered with a refusal (FAILED) —
 * a resend with the same id would have been accepted had the first one been
 * stored. A PENDING operation with attempts may have been cut off by the
 * network after the server stored it, so it stays.
 *
 * Reports whether any operation remains, in which case the server may hold
 * the record and the caller must queue its removal instead of forgetting it.
 * A dependency on a cancelled operation no longer holds anything back: the
 * synchronization only waits for ids still in the queue.
 */
export async function cancelPendingOperations(
  transaction: SQLiteDatabase,
  entityType: OperationEntity,
  entityId: string
): Promise<{ reachedServer: boolean }> {
  await transaction.runAsync(
    `DELETE FROM sync_operations
      WHERE entity_type = ? AND entity_id = ?
        AND ((status = 'PENDING' AND attempt_count = 0) OR status = 'FAILED')`,
    entityType,
    entityId
  );
  const remaining = await transaction.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_operations WHERE entity_type = ? AND entity_id = ?`,
    entityType,
    entityId
  );
  return { reachedServer: (remaining?.total ?? 0) > 0 };
}

const OPERATION_COLUMNS = `operation_id, entity_type, entity_id, inspection_id, operation_type,
  base_version, payload_json, dependency_ids, status, attempt_count, last_error`;

/**
 * Operations not yet confirmed, oldest first. CONFLICT ones are listed too:
 * they are not resent (card #28 resolves them), but whatever depends on them
 * must be held back.
 */
export async function listOpenOperations(ownerUserId: string): Promise<QueuedOperation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<OperationRow>(
    `SELECT ${OPERATION_COLUMNS} FROM sync_operations
      WHERE owner_user_id = ? AND status <> 'COMPLETED'
      ORDER BY created_at, rowid`,
    ownerUserId
  );
  return rows.map(toQueuedOperation);
}

/** RN-071: the count the home screen and the sync tab show. */
export async function countOpenOperations(ownerUserId: string): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_operations
      WHERE owner_user_id = ? AND status <> 'COMPLETED'`,
    ownerUserId
  );
  return row?.total ?? 0;
}

/**
 * Takes an operation for sending and returns it as stored at that instant.
 *
 * The payload is read again here, inside the same write, because an edit may
 * have been folded into the operation after the run listed it; sending the
 * listed copy would mark the newer answer as delivered without ever sending
 * it. Once PROCESSING, the operation no longer folds, so a later edit opens a
 * new one. Returns `null` when the operation is no longer waiting.
 */
export function claimOperation(operationId: string, now: string): Promise<QueuedOperation | null> {
  return writeTransaction(async (transaction) => {
    const claimed = await transaction.runAsync(
      `UPDATE sync_operations
          SET status = 'PROCESSING', attempt_count = attempt_count + 1,
              last_attempt_at = ?, updated_at = ?
        WHERE operation_id = ? AND status IN ('PENDING', 'FAILED')`,
      now,
      now,
      operationId
    );
    if (claimed.changes === 0) {
      return null;
    }
    const row = await transaction.getFirstAsync<OperationRow>(
      `SELECT ${OPERATION_COLUMNS} FROM sync_operations WHERE operation_id = ?`,
      operationId
    );
    return row === null ? null : toQueuedOperation(row);
  });
}

/**
 * Puts back operations left PROCESSING by a run that never finished — the app
 * closed mid-send. Resending them is safe: the id is the same (RN-068).
 */
export async function releaseInterruptedOperations(
  ownerUserId: string,
  now: string
): Promise<void> {
  await writeTransaction((transaction) =>
    transaction.runAsync(
      `UPDATE sync_operations SET status = 'PENDING', updated_at = ?
        WHERE owner_user_id = ? AND status = 'PROCESSING'`,
      now,
      ownerUserId
    )
  );
}

/**
 * Closes the operation and, when it was the last one owed for its records,
 * marks the record and the inspection as confirmed by the server.
 */
export async function markCompleted(operation: QueuedOperation, now: string): Promise<void> {
  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      `UPDATE sync_operations
          SET status = 'COMPLETED', last_error = NULL, completed_at = ?, updated_at = ?
        WHERE operation_id = ?`,
      now,
      now,
      operation.operationId
    );

    const table = ENTITY_TABLES[operation.entityType];
    if (table !== undefined) {
      await transaction.runAsync(
        `UPDATE ${table}
            SET is_dirty = 0, local_sync_status = 'SYNCED', last_synced_at = ?, sync_error = NULL
          WHERE id = ? AND NOT EXISTS (
            SELECT 1 FROM sync_operations
             WHERE entity_type = ? AND entity_id = ? AND status <> 'COMPLETED')`,
        now,
        operation.entityId,
        operation.entityType,
        operation.entityId
      );
    }

    await transaction.runAsync(
      `UPDATE inspections
          SET is_dirty = 0, local_sync_status = 'SYNCED', last_synced_at = ?, sync_error = NULL
        WHERE id = ? AND NOT EXISTS (
          SELECT 1 FROM sync_operations WHERE inspection_id = ? AND status <> 'COMPLETED')`,
      now,
      operation.inspectionId,
      operation.inspectionId
    );
  });
}

/**
 * Records a refusal. The operation stays in the queue — nothing the
 * technician did is dropped — and its records show the failure (RN-070).
 * No other operation is touched. `error` should be business wording or a
 * failure kind; it is sanitized again before it is stored.
 */
export async function markFailed(
  operation: QueuedOperation,
  status: 'FAILED' | 'CONFLICT',
  reason: string,
  now: string
): Promise<void> {
  const localStatus = status === 'CONFLICT' ? 'CONFLICT' : 'ERROR';
  const error = sanitizeSyncError(reason);

  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      `UPDATE sync_operations SET status = ?, last_error = ?, updated_at = ? WHERE operation_id = ?`,
      status,
      error,
      now,
      operation.operationId
    );
    const table = ENTITY_TABLES[operation.entityType];
    if (table !== undefined) {
      await transaction.runAsync(
        `UPDATE ${table} SET local_sync_status = ?, sync_error = ? WHERE id = ?`,
        localStatus,
        error,
        operation.entityId
      );
    }
    await transaction.runAsync(
      `UPDATE inspections SET local_sync_status = ?, sync_error = ? WHERE id = ?`,
      localStatus,
      error,
      operation.inspectionId
    );
  });
}

/**
 * The server refused the completion — an answer it requires is missing, for
 * instance (backend#20). The inspection goes back to IN_PROGRESS so the
 * technician can fix it (RN-043), the refused submit leaves the queue, and
 * the reason stays on the inspection. Completing again queues a new submit,
 * with a new reading of the position.
 */
export async function reopenAfterRefusedSubmit(
  operation: QueuedOperation,
  reason: string,
  now: string
): Promise<void> {
  const error = sanitizeSyncError(reason);

  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      'DELETE FROM sync_operations WHERE operation_id = ?',
      operation.operationId
    );
    await transaction.runAsync(
      `UPDATE inspections
          SET status = 'IN_PROGRESS', completed_at_device = NULL, local_sync_status = 'ERROR',
              completion_latitude = NULL, completion_longitude = NULL, completion_accuracy = NULL,
              completion_location_at = NULL, completion_location_missing = NULL,
              sync_error = ?, local_updated_at = ?
        WHERE id = ? AND status = 'SUBMITTED'`,
      error,
      now,
      operation.inspectionId
    );
  });
}

/** An attempt cut short by the network goes back to the queue unchanged. */
export async function releaseOperation(operationId: string, now: string): Promise<void> {
  await writeTransaction((transaction) =>
    transaction.runAsync(
      `UPDATE sync_operations SET status = 'PENDING', updated_at = ?
        WHERE operation_id = ? AND status = 'PROCESSING'`,
      now,
      operationId
    )
  );
}
