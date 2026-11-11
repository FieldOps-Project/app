import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';

export type OperationEntity = 'INSPECTION' | 'RESPONSE' | 'EVIDENCE' | 'NON_CONFORMITY';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE_LOGICAL' | 'TRANSITION' | 'UPLOAD';

const ENTITY_TABLES: Partial<Record<OperationEntity, string>> = {
  RESPONSE: 'inspection_responses',
  EVIDENCE: 'evidences',
  NON_CONFORMITY: 'non_conformities',
};

const MAX_ERROR_LENGTH = 300;

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

export async function countOpenOperations(ownerUserId: string): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_operations
      WHERE owner_user_id = ? AND status <> 'COMPLETED'`,
    ownerUserId
  );
  return row?.total ?? 0;
}

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
