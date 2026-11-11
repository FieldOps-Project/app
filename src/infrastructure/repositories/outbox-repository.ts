import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';

/**
 * Persistent outbox (document 10.13.3). Every confirmed change on the device
 * becomes, or updates, one operation here; the synchronization reads them in
 * order and sends them with their idempotent id.
 *
 * Sprint 4 brings the table forward so starting and completing survive a
 * restart offline. Batching, dependency ordering and retry policy are card
 * #24's scope.
 */

export type OperationEntity = 'INSPECTION' | 'RESPONSE';

export type OperationType = 'CREATE' | 'UPDATE' | 'TRANSITION';

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
 * server. State transitions are never folded; each one is its own step.
 *
 * Runs on the caller's transaction, so the record and its operation are saved
 * together or not at all.
 */
export async function enqueueOperation(
  transaction: SQLiteDatabase,
  operation: NewOperation,
  now: string
): Promise<void> {
  if (operation.operationType !== 'TRANSITION') {
    const folded = await transaction.runAsync(
      `UPDATE sync_operations
          SET payload_json = ?, status = 'PENDING', last_error = NULL, updated_at = ?
        WHERE entity_type = ? AND entity_id = ? AND status IN ('PENDING', 'FAILED')`,
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
 * marks the response and the inspection as confirmed by the server.
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

    if (operation.entityType === 'RESPONSE') {
      await transaction.runAsync(
        `UPDATE inspection_responses
            SET is_dirty = 0, local_sync_status = 'SYNCED', last_synced_at = ?, sync_error = NULL
          WHERE id = ? AND NOT EXISTS (
            SELECT 1 FROM sync_operations
             WHERE entity_type = 'RESPONSE' AND entity_id = ? AND status <> 'COMPLETED')`,
        now,
        operation.entityId,
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
 * `error` must already be sanitized: business wording or a failure kind,
 * never a token or a payload.
 */
export async function markFailed(
  operation: QueuedOperation,
  status: 'FAILED' | 'CONFLICT',
  error: string,
  now: string
): Promise<void> {
  const localStatus = status === 'CONFLICT' ? 'CONFLICT' : 'ERROR';

  await writeTransaction(async (transaction) => {
    await transaction.runAsync(
      `UPDATE sync_operations SET status = ?, last_error = ?, updated_at = ? WHERE operation_id = ?`,
      status,
      error,
      now,
      operation.operationId
    );
    if (operation.entityType === 'RESPONSE') {
      await transaction.runAsync(
        `UPDATE inspection_responses SET local_sync_status = ?, sync_error = ? WHERE id = ?`,
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
  error: string,
  now: string
): Promise<void> {
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
