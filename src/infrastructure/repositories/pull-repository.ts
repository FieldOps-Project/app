import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';
import { sanitizeSyncError } from '@/infrastructure/repositories/outbox-repository';
import {
  pulledResponseSchema,
  RESPONSE_ENTITY,
  type PulledChange,
  type PulledResponse,
} from '@/schemas/sync-pull';

export const SERVER_CHANGED_RESPONSE =
  'Esta resposta foi alterada no servidor. O valor registrado neste aparelho foi preservado.';

export interface PulledPageOutcome {
  readonly applied: number;
  readonly conflicts: number;
  readonly unresolved: number;
  readonly cursorAdvanced: boolean;
}

interface LocalResponse {
  id: string;
  is_dirty: number;
  base_version: number;
  acknowledged: number;
}

export async function readPullCursor(ownerUserId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ pull_cursor: string | null }>(
    'SELECT pull_cursor FROM sync_metadata WHERE owner_user_id = ?',
    ownerUserId
  );
  return row?.pull_cursor ?? null;
}

export async function applyPulledPage(
  ownerUserId: string,
  changes: readonly PulledChange[],
  nextCursor: string | null,
  now: string
): Promise<PulledPageOutcome> {
  return writeTransaction(async (transaction) => {
    let applied = 0;
    let conflicts = 0;
    let unresolved = 0;

    for (const change of changes) {
      if (change.entityType !== RESPONSE_ENTITY || change.changeType !== 'UPSERT') {
        continue;
      }
      const parsed = pulledResponseSchema.safeParse(change.payload);
      if (!parsed.success) {
        continue;
      }
      const outcome = await applyResponse(transaction, ownerUserId, parsed.data, now);
      if (outcome === 'unresolved') {
        unresolved += 1;
      } else if (outcome === 'conflict') {
        conflicts += 1;
      } else if (outcome === 'applied') {
        applied += 1;
      }
    }

    const advance = unresolved === 0 && nextCursor !== null;
    if (advance) {
      await transaction.runAsync(
        `INSERT INTO sync_metadata (owner_user_id, pull_cursor, last_pull_at) VALUES (?, ?, ?)
         ON CONFLICT (owner_user_id) DO UPDATE SET
           pull_cursor = excluded.pull_cursor, last_pull_at = excluded.last_pull_at`,
        ownerUserId,
        nextCursor,
        now
      );
    }
    return { applied, conflicts, unresolved, cursorAdvanced: advance };
  });
}

async function applyResponse(
  transaction: SQLiteDatabase,
  ownerUserId: string,
  remote: PulledResponse,
  now: string
): Promise<'applied' | 'conflict' | 'unresolved' | 'ignored'> {
  const known = await transaction.getFirstAsync<{ id: string }>(
    `SELECT items.id FROM inspection_items AS items
       JOIN inspections ON inspections.id = items.inspection_id
      WHERE items.id = ? AND items.inspection_id = ? AND inspections.owner_user_id = ?`,
    remote.inspectionItemId,
    remote.inspectionId,
    ownerUserId
  );
  if (known === null) {
    return 'unresolved';
  }

  const local = await transaction.getFirstAsync<LocalResponse>(
    `SELECT r.id, r.is_dirty, r.base_version,
            (r.last_synced_at IS NOT NULL OR EXISTS (
               SELECT 1 FROM sync_operations o
                WHERE o.entity_type = 'RESPONSE' AND o.entity_id = r.id AND o.status = 'COMPLETED'
            )) AS acknowledged
       FROM inspection_responses r WHERE r.inspection_item_id = ?`,
    remote.inspectionItemId
  );

  if (local === null) {
    await transaction.runAsync(
      `INSERT INTO inspection_responses (
         id, inspection_id, inspection_item_id, value_text, value_number, value_boolean,
         value_date, conformity, observation, answered_at_device, base_version,
         last_synced_at, local_sync_status, is_dirty
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', 0)`,
      remote.id,
      remote.inspectionId,
      remote.inspectionItemId,
      remote.valueText,
      remote.valueNumber,
      remote.valueBoolean === null ? null : remote.valueBoolean ? 1 : 0,
      remote.valueDate,
      remote.conformity,
      remote.observation,
      remote.answeredAtDevice,
      remote.version,
      now
    );
    return 'applied';
  }

  if (local.is_dirty === 1) {
    return diverges(local, remote) ? recordConflict(transaction, local, remote, now) : 'ignored';
  }

  if (local.acknowledged === 1 && remote.version < local.base_version) {
    return 'ignored';
  }

  await transaction.runAsync(
    `UPDATE inspection_responses SET
       value_text = ?, value_number = ?, value_boolean = ?, value_date = ?, conformity = ?,
       observation = ?, answered_at_device = ?, base_version = ?, last_synced_at = ?,
       local_sync_status = 'SYNCED', sync_error = NULL
     WHERE id = ?`,
    remote.valueText,
    remote.valueNumber,
    remote.valueBoolean === null ? null : remote.valueBoolean ? 1 : 0,
    remote.valueDate,
    remote.conformity,
    remote.observation,
    remote.answeredAtDevice,
    remote.version,
    now,
    local.id
  );
  return 'applied';
}

function diverges(local: LocalResponse, remote: PulledResponse): boolean {
  if (local.id !== remote.id) {
    return true;
  }
  return local.acknowledged === 1 && remote.version > local.base_version;
}

async function recordConflict(
  transaction: SQLiteDatabase,
  local: LocalResponse,
  remote: PulledResponse,
  now: string
): Promise<'conflict' | 'ignored'> {
  const message = sanitizeSyncError(SERVER_CHANGED_RESPONSE);
  const open = await transaction.runAsync(
    `UPDATE sync_operations
        SET status = 'CONFLICT', last_error = ?, server_state_json = ?, updated_at = ?
      WHERE entity_type = 'RESPONSE' AND entity_id = ?
        AND status IN ('PENDING', 'FAILED', 'CONFLICT')`,
    message,
    JSON.stringify(remote),
    now,
    local.id
  );
  if (open.changes === 0) {
    return 'ignored';
  }
  await transaction.runAsync(
    `UPDATE inspection_responses SET local_sync_status = 'CONFLICT', sync_error = ? WHERE id = ?`,
    message,
    local.id
  );
  await transaction.runAsync(
    `UPDATE inspections SET local_sync_status = 'CONFLICT', sync_error = ?
      WHERE id = (SELECT inspection_id FROM inspection_responses WHERE id = ?)`,
    message,
    local.id
  );
  return 'conflict';
}
