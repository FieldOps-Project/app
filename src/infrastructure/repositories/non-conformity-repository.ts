import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';
import type { NonConformity, Severity } from '@/domain/non-conformity';
import {
  lockInspection,
  markInspectionDirty,
} from '@/infrastructure/repositories/inspection-repository';
import {
  NonConformityAnswerError,
  NonConformityItemError,
} from '@/infrastructure/repositories/non-conformity-errors';
import { toSyncState, type LocalSyncStatus } from '@/infrastructure/repositories/inspection-rows';
import {
  cancelPendingOperations,
  enqueueOperation,
  openOperationIdsFor,
} from '@/infrastructure/repositories/outbox-repository';

export interface CreateNonConformityCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly inspectionItemId: string;
  readonly nonConformityId: string;
  readonly operationId: string;
  readonly createdAtDevice: string;
  readonly title: string;
  readonly description: string;
  readonly severity: Severity;
}

export async function createNonConformity(command: CreateNonConformityCommand): Promise<void> {
  const now = command.createdAtDevice;

  await writeTransaction(async (transaction) => {
    const { base_version } = await lockInspection(
      transaction,
      command.ownerUserId,
      command.inspectionId,
      ['IN_PROGRESS']
    );
    const item = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM inspection_items WHERE id = ? AND inspection_id = ?',
      command.inspectionItemId,
      command.inspectionId
    );
    if (item === null) {
      throw new NonConformityItemError();
    }
    const response = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM inspection_responses WHERE inspection_item_id = ? AND inspection_id = ?',
      command.inspectionItemId,
      command.inspectionId
    );
    if (response === null) {
      throw new NonConformityAnswerError();
    }
    const responseId = response.id;

    await transaction.runAsync(
      `INSERT INTO non_conformities (
         id, inspection_id, inspection_item_id, response_id, title, description, severity,
         created_at_device, base_version, local_updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      command.nonConformityId,
      command.inspectionId,
      command.inspectionItemId,
      responseId,
      command.title,
      command.description,
      command.severity,
      command.createdAtDevice,
      base_version,
      now
    );

    const dependencyIds = await openOperationIdsFor(transaction, 'RESPONSE', responseId);
    await markInspectionDirty(transaction, command.inspectionId, now);
    await enqueueOperation(
      transaction,
      {
        operationId: command.operationId,
        ownerUserId: command.ownerUserId,
        entityType: 'NON_CONFORMITY',
        entityId: command.nonConformityId,
        inspectionId: command.inspectionId,
        operationType: 'CREATE',
        baseVersion: base_version,
        payload: {
          id: command.nonConformityId,
          inspectionItemId: command.inspectionItemId,
          responseId,
          title: command.title,
          description: command.description,
          severity: command.severity,
          status: 'OPEN',
          createdAtDevice: command.createdAtDevice,
        },
        dependencyIds,
      },
      now
    );
  });
}

interface NonConformityRow {
  id: string;
  inspection_id: string;
  inspection_item_id: string | null;
  item_title: string | null;
  title: string;
  description: string;
  severity: Severity;
  created_at_device: string;
  local_sync_status: LocalSyncStatus;
  local_updated_at: string | null;
  evidence_count: number;
}

export async function listNonConformities(
  ownerUserId: string,
  inspectionId: string
): Promise<NonConformity[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<NonConformityRow>(
    `SELECT nc.id, nc.inspection_id, nc.inspection_item_id, item.item_title, nc.title,
            nc.description, nc.severity, nc.created_at_device, nc.local_sync_status,
            nc.local_updated_at,
            (SELECT COUNT(*) FROM evidences ev
              WHERE ev.non_conformity_id = nc.id AND ev.deleted_locally = 0) AS evidence_count
       FROM non_conformities nc
       JOIN inspections insp ON insp.id = nc.inspection_id
       LEFT JOIN inspection_items item ON item.id = nc.inspection_item_id
      WHERE nc.inspection_id = ? AND insp.owner_user_id = ? AND nc.deleted_locally = 0
      ORDER BY nc.created_at_device, nc.rowid`,
    inspectionId,
    ownerUserId
  );
  return rows.map((row) => ({
    id: row.id,
    inspectionId: row.inspection_id,
    inspectionItemId: row.inspection_item_id,
    itemTitle: row.item_title,
    title: row.title,
    description: row.description,
    severity: row.severity,
    createdAtDevice: row.created_at_device,
    syncState: toSyncState(row.local_sync_status, row.local_updated_at),
    evidenceCount: row.evidence_count,
  }));
}

export interface DeleteNonConformityCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly nonConformityId: string;
  readonly deletedAtDevice: string;
}

export type DeletedNonConformity =
  | { readonly outcome: 'removed'; readonly files: readonly string[] }
  | { readonly outcome: 'already-sent' }
  | { readonly outcome: 'not-found' };

export async function deleteNonConformity(
  command: DeleteNonConformityCommand
): Promise<DeletedNonConformity> {
  return writeTransaction(async (transaction) => {
    await lockInspection(transaction, command.ownerUserId, command.inspectionId, ['IN_PROGRESS']);
    const existing = await transaction.getFirstAsync<{ id: string }>(
      `SELECT id FROM non_conformities
        WHERE id = ? AND inspection_id = ? AND deleted_locally = 0`,
      command.nonConformityId,
      command.inspectionId
    );
    if (existing === null) {
      return { outcome: 'not-found' } as const;
    }

    const evidences = await transaction.getAllAsync<{
      id: string;
      local_uri: string | null;
      thumbnail_uri: string | null;
    }>(
      `SELECT id, local_uri, thumbnail_uri FROM evidences
        WHERE non_conformity_id = ? AND deleted_locally = 0`,
      command.nonConformityId
    );
    const { reachedServer } = await cancelPendingOperations(
      transaction,
      'NON_CONFORMITY',
      command.nonConformityId
    );
    if (reachedServer) {
      return { outcome: 'already-sent' } as const;
    }

    const files: string[] = [];
    for (const evidence of evidences) {
      await cancelPendingOperations(transaction, 'EVIDENCE', evidence.id);
      await transaction.runAsync('DELETE FROM evidences WHERE id = ?', evidence.id);
      for (const uri of [evidence.local_uri, evidence.thumbnail_uri]) {
        if (uri !== null) {
          files.push(uri);
        }
      }
    }
    await transaction.runAsync(
      'DELETE FROM non_conformities WHERE id = ?',
      command.nonConformityId
    );
    await transaction.runAsync(
      `UPDATE inspections SET is_dirty = 0, local_sync_status = 'SYNCED', sync_error = NULL
        WHERE id = ? AND is_dirty = 1 AND NOT EXISTS (
          SELECT 1 FROM sync_operations WHERE inspection_id = ? AND status <> 'COMPLETED')`,
      command.inspectionId,
      command.inspectionId
    );
    return { outcome: 'removed', files } as const;
  });
}
