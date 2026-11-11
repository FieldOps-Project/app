import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import type { LocationCapture } from '@/domain/field-location';
import type { InspectionDetail, InspectionStatus, InspectionSummary } from '@/domain/inspection';
import { getDatabase } from '@/infrastructure/database/database';
import { writeTransaction } from '@/infrastructure/database/write-transaction';
import {
  enqueueOperation,
  openOperationIds,
} from '@/infrastructure/repositories/outbox-repository';
import {
  toChecklistItem,
  toChecklistResponse,
  toDetail,
  toSummary,
  type InspectionRow,
  type ItemRow,
  type ResponseRow,
} from '@/infrastructure/repositories/inspection-rows';
import type { LocationPayload } from '@/infrastructure/api/mobile-inspections-api';
import type { MobileInspection } from '@/schemas/mobile-inspection';

/**
 * Inspections stored on the device: the operational source of the app, not a
 * disposable cache (document 10.13). Every read is scoped to the signed-in
 * technician, so a shared device never shows one person's work to another
 * (RN-004).
 */

export interface StoredInspection {
  readonly detail: InspectionDetail;
  readonly items: readonly ChecklistItem[];
  readonly responses: readonly ChecklistResponse[];
  /** Evidences registered per snapshot item id. */
  readonly evidenceCounts: ReadonlyMap<string, number>;
}

export async function listInspectionSummaries(ownerUserId: string): Promise<InspectionSummary[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<InspectionRow>(
    'SELECT * FROM inspections WHERE owner_user_id = ? ORDER BY scheduled_for, id',
    ownerUserId
  );
  return rows.map(toSummary);
}

export async function findInspection(
  ownerUserId: string,
  inspectionId: string
): Promise<StoredInspection | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<InspectionRow>(
    'SELECT * FROM inspections WHERE id = ? AND owner_user_id = ?',
    inspectionId,
    ownerUserId
  );
  if (row === null) {
    return null;
  }

  const [items, responses, evidences] = await Promise.all([
    database.getAllAsync<ItemRow>(
      `SELECT * FROM inspection_items WHERE inspection_id = ?
        ORDER BY section_order, item_order`,
      inspectionId
    ),
    database.getAllAsync<ResponseRow>(
      'SELECT * FROM inspection_responses WHERE inspection_id = ?',
      inspectionId
    ),
    database.getAllAsync<{ inspection_item_id: string; total: number }>(
      `SELECT inspection_item_id, COUNT(*) AS total FROM evidences
        WHERE inspection_id = ? GROUP BY inspection_item_id`,
      inspectionId
    ),
  ]);

  return {
    detail: toDetail(row),
    items: items.map(toChecklistItem),
    responses: responses.map(toChecklistResponse),
    evidenceCounts: new Map(evidences.map((entry) => [entry.inspection_item_id, entry.total])),
  };
}

export async function findServerUpdates(ownerUserId: string): Promise<Map<string, string | null>> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: string; server_updated_at: string | null }>(
    'SELECT id, server_updated_at FROM inspections WHERE owner_user_id = ?',
    ownerUserId
  );
  return new Map(rows.map((row) => [row.id, row.server_updated_at]));
}

/**
 * Writes one downloaded inspection in a single transaction (document 10.14.1).
 *
 * Local work always wins over the download: an inspection with changes not
 * yet sent keeps its local state, and an answer not yet sent is never
 * replaced (card #22). The one server fact applied over local work is a
 * cancellation, which is recorded without discarding anything (RN-077).
 * The snapshot is immutable, so items already stored are left as they are.
 *
 * The local check is by id on purpose: if another technician left unsent
 * work on this device for an inspection now assigned elsewhere, that work is
 * kept rather than handed over (ADR-001 leaves shared devices to EP-08).
 */
export async function saveDownloadedInspection(
  ownerUserId: string,
  remote: MobileInspection,
  now: string
): Promise<void> {
  await writeTransaction(async (transaction) => {
    const local = await transaction.getFirstAsync<{ is_dirty: number }>(
      'SELECT is_dirty FROM inspections WHERE id = ?',
      remote.id
    );

    if (local !== null && local.is_dirty === 1) {
      if (remote.status === 'CANCELED') {
        await transaction.runAsync(
          `UPDATE inspections SET status = 'CANCELED', local_sync_status = 'CONFLICT',
                  sync_error = ?, server_updated_at = ? WHERE id = ?`,
          'A inspeção foi cancelada no servidor. Os dados registrados continuam no aparelho.',
          remote.updatedAt,
          remote.id
        );
      }
      return;
    }

    await upsertInspectionRow(transaction, ownerUserId, remote, now);
    await insertSnapshot(transaction, remote);
    await upsertServerResponses(transaction, remote, now);
  });
}

async function upsertInspectionRow(
  transaction: SQLiteDatabase,
  ownerUserId: string,
  remote: MobileInspection,
  now: string
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO inspections (
       id, owner_user_id, title, status, priority, scheduled_for, instructions,
       client_id, client_name, site_id, site_name, site_address, site_latitude, site_longitude,
       equipment_id, equipment_name, equipment_qr_code, equipment_asset_number,
       equipment_serial_number, started_at_device, completed_at_device, review_json,
       start_latitude, start_longitude, start_accuracy, start_location_at,
       completion_latitude, completion_longitude, completion_accuracy, completion_location_at,
       server_updated_at, base_version, local_sync_status, is_dirty, last_synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, 'SYNCED', 0, ?)
     ON CONFLICT (id) DO UPDATE SET
       owner_user_id = excluded.owner_user_id, title = excluded.title,
       status = excluded.status, priority = excluded.priority,
       scheduled_for = excluded.scheduled_for, instructions = excluded.instructions,
       client_id = excluded.client_id, client_name = excluded.client_name,
       site_id = excluded.site_id, site_name = excluded.site_name,
       site_address = excluded.site_address, site_latitude = excluded.site_latitude,
       site_longitude = excluded.site_longitude, equipment_id = excluded.equipment_id,
       equipment_name = excluded.equipment_name, equipment_qr_code = excluded.equipment_qr_code,
       equipment_asset_number = excluded.equipment_asset_number,
       equipment_serial_number = excluded.equipment_serial_number,
       started_at_device = excluded.started_at_device,
       completed_at_device = excluded.completed_at_device, review_json = excluded.review_json,
       ${keepLocalPositionUnlessReported('start')},
       ${keepLocalPositionUnlessReported('completion')},
       server_updated_at = excluded.server_updated_at, base_version = excluded.base_version,
       local_sync_status = 'SYNCED', sync_error = NULL, last_synced_at = excluded.last_synced_at`,
    remote.id,
    ownerUserId,
    remote.title,
    remote.status,
    remote.priority,
    remote.scheduledFor,
    remote.instructions,
    remote.client.id,
    remote.client.name,
    remote.site.id,
    remote.site.name,
    remote.site.addressLine,
    remote.site.latitude,
    remote.site.longitude,
    remote.equipment?.id ?? null,
    remote.equipment?.name ?? null,
    remote.equipment?.qrCode ?? null,
    remote.equipment?.assetNumber ?? null,
    remote.equipment?.serialNumber ?? null,
    remote.startedAtDevice,
    remote.completedAtDevice,
    remote.review === null ? null : JSON.stringify(remote.review),
    ...positionValues(remote.startLocation),
    ...positionValues(remote.completionLocation),
    remote.updatedAt,
    remote.version,
    now
  );
}

function positionValues(position: MobileInspection['startLocation']) {
  return position === null
    ? ([null, null, null, null] as const)
    : ([position.latitude, position.longitude, position.accuracy, position.capturedAt] as const);
}

/**
 * A position the server reports replaces the local one as a whole, and clears
 * any recorded reason for a gap. One it does not report — a contract still
 * settling (backend#19), or a transition sent without a position — never
 * erases what the device captured or why it could not.
 */
function keepLocalPositionUnlessReported(prefix: 'start' | 'completion'): string {
  const reported = `excluded.${prefix}_latitude IS NOT NULL`;
  const columns = ['latitude', 'longitude', 'accuracy', 'location_at'].map(
    (column) =>
      `${prefix}_${column} = CASE WHEN ${reported} THEN excluded.${prefix}_${column}
         ELSE inspections.${prefix}_${column} END`
  );
  columns.push(
    `${prefix}_location_missing = CASE WHEN ${reported} THEN NULL
       ELSE inspections.${prefix}_location_missing END`
  );
  return columns.join(',\n       ');
}

async function insertSnapshot(transaction: SQLiteDatabase, remote: MobileInspection) {
  for (const item of remote.items) {
    await transaction.runAsync(
      `INSERT OR IGNORE INTO inspection_items (
         id, inspection_id, section_title, section_description, section_order, item_code,
         item_title, item_description, response_type, required, rules_json, options_json,
         item_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      remote.id,
      item.sectionTitle,
      item.sectionDescription,
      item.sectionOrder,
      item.itemCode,
      item.itemTitle,
      item.itemDescription,
      item.responseType,
      item.required ? 1 : 0,
      JSON.stringify(item.rules),
      JSON.stringify(item.options),
      item.itemOrder
    );
  }
}

/**
 * Server answers fill the gaps and refresh what is already confirmed; an
 * answer edited on the device and not yet sent is left untouched.
 */
async function upsertServerResponses(
  transaction: SQLiteDatabase,
  remote: MobileInspection,
  now: string
) {
  for (const response of remote.responses) {
    const local = await transaction.getFirstAsync<{ is_dirty: number }>(
      'SELECT is_dirty FROM inspection_responses WHERE inspection_item_id = ?',
      response.inspectionItemId
    );
    if (local !== null && local.is_dirty === 1) {
      continue;
    }

    const values = [
      response.valueText,
      response.valueNumber,
      toSqlBoolean(response.valueBoolean),
      response.valueDate,
      response.conformity,
      response.observation,
      response.answeredAtDevice,
      remote.version,
      now,
    ];

    if (local === null) {
      await transaction.runAsync(
        `INSERT INTO inspection_responses (
           id, inspection_id, inspection_item_id, value_text, value_number, value_boolean,
           value_date, conformity, observation, answered_at_device, base_version,
           last_synced_at, local_sync_status, is_dirty
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SYNCED', 0)`,
        response.id,
        remote.id,
        response.inspectionItemId,
        ...values
      );
    } else {
      await transaction.runAsync(
        `UPDATE inspection_responses SET
           value_text = ?, value_number = ?, value_boolean = ?, value_date = ?, conformity = ?,
           observation = ?, answered_at_device = ?, base_version = ?, last_synced_at = ?,
           local_sync_status = 'SYNCED', sync_error = NULL
         WHERE inspection_item_id = ?`,
        ...values,
        response.inspectionItemId
      );
    }
  }
}

function toSqlBoolean(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0;
}

/**
 * Thrown when a write meets a state that no longer allows it, such as an
 * answer saved after the completion. The screens prevent these paths; this is
 * the last line, checked inside the same transaction as the write.
 */
export class InspectionStateError extends Error {
  constructor(readonly status: InspectionStatus | null) {
    super('A inspeção não está em um estado que permita esta alteração.');
    this.name = 'InspectionStateError';
  }
}

async function lockInspection(
  transaction: SQLiteDatabase,
  ownerUserId: string,
  inspectionId: string,
  allowed: readonly InspectionStatus[]
): Promise<{ base_version: number }> {
  const row = await transaction.getFirstAsync<{ status: InspectionStatus; base_version: number }>(
    'SELECT status, base_version FROM inspections WHERE id = ? AND owner_user_id = ?',
    inspectionId,
    ownerUserId
  );
  if (row === null || !allowed.includes(row.status)) {
    throw new InspectionStateError(row?.status ?? null);
  }
  return row;
}

async function markInspectionDirty(transaction: SQLiteDatabase, inspectionId: string, now: string) {
  await transaction.runAsync(
    `UPDATE inspections SET is_dirty = 1, local_sync_status = 'PENDING', local_updated_at = ?
      WHERE id = ?`,
    now,
    inspectionId
  );
}

export interface StartCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly operationId: string;
  /** Device clock at the moment of the confirmation (RN-034). */
  readonly startedAtDevice: string;
  /** The single reading taken at the start (card #19). */
  readonly location: LocationCapture;
}

/** The server takes the position or `null`; the reason for a gap stays on the device. */
function toLocationPayload(capture: LocationCapture): LocationPayload | null {
  return capture.status === 'captured' ? capture.position : null;
}

/** Column values in the order latitude, longitude, accuracy, captured at, missing reason. */
function locationColumns(capture: LocationCapture) {
  return capture.status === 'captured'
    ? ([
        capture.position.latitude,
        capture.position.longitude,
        capture.position.accuracy,
        capture.position.capturedAt,
        null,
      ] as const)
    : ([null, null, null, null, capture.reason] as const);
}

/** UC-09: the local state and its queued operation are written together. */
export async function startInspection(command: StartCommand): Promise<void> {
  const now = command.startedAtDevice;

  await writeTransaction(async (transaction) => {
    const { base_version } = await lockInspection(
      transaction,
      command.ownerUserId,
      command.inspectionId,
      ['ASSIGNED']
    );

    await transaction.runAsync(
      `UPDATE inspections SET status = 'IN_PROGRESS', started_at_device = ?,
              start_latitude = ?, start_longitude = ?, start_accuracy = ?,
              start_location_at = ?, start_location_missing = ?
        WHERE id = ?`,
      command.startedAtDevice,
      ...locationColumns(command.location),
      command.inspectionId
    );
    await markInspectionDirty(transaction, command.inspectionId, now);
    await enqueueOperation(
      transaction,
      {
        operationId: command.operationId,
        ownerUserId: command.ownerUserId,
        entityType: 'INSPECTION',
        entityId: command.inspectionId,
        inspectionId: command.inspectionId,
        operationType: 'TRANSITION',
        baseVersion: base_version,
        payload: {
          action: 'START',
          startedAtDevice: command.startedAtDevice,
          location: toLocationPayload(command.location),
        },
      },
      now
    );
  });
}

export interface SaveResponseCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly operationId: string;
  readonly response: ChecklistResponse;
}

/**
 * Document 10.14.2: the answer is saved on the device and its operation is
 * created or folded into the pending one. Nothing here waits for the network.
 */
export async function saveResponse({
  ownerUserId,
  inspectionId,
  operationId,
  response,
}: SaveResponseCommand): Promise<void> {
  const now = response.answeredAtDevice;

  await writeTransaction(async (transaction) => {
    const { base_version } = await lockInspection(transaction, ownerUserId, inspectionId, [
      'IN_PROGRESS',
    ]);

    const existing = await transaction.getFirstAsync<{ id: string; last_synced_at: string | null }>(
      'SELECT id, last_synced_at FROM inspection_responses WHERE inspection_item_id = ?',
      response.inspectionItemId
    );
    const responseId = existing?.id ?? response.id;
    const values = [
      response.valueText,
      response.valueNumber,
      toSqlBoolean(response.valueBoolean),
      response.valueDate,
      response.conformity,
      response.observation,
      response.answeredAtDevice,
      now,
    ];

    if (existing === null) {
      await transaction.runAsync(
        `INSERT INTO inspection_responses (
           id, inspection_id, inspection_item_id, base_version, value_text, value_number,
           value_boolean, value_date, conformity, observation, answered_at_device,
           local_updated_at, local_sync_status, is_dirty
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)`,
        responseId,
        inspectionId,
        response.inspectionItemId,
        base_version,
        ...values
      );
    } else {
      await transaction.runAsync(
        `UPDATE inspection_responses SET
           value_text = ?, value_number = ?, value_boolean = ?, value_date = ?, conformity = ?,
           observation = ?, answered_at_device = ?, local_updated_at = ?,
           local_sync_status = 'PENDING', is_dirty = 1, sync_error = NULL
         WHERE id = ?`,
        ...values,
        responseId
      );
    }
    await markInspectionDirty(transaction, inspectionId, now);
    await enqueueOperation(
      transaction,
      {
        operationId,
        ownerUserId,
        entityType: 'RESPONSE',
        entityId: responseId,
        inspectionId,
        operationType: existing?.last_synced_at == null ? 'CREATE' : 'UPDATE',
        baseVersion: base_version,
        payload: { ...response, id: responseId, baseVersion: base_version },
      },
      now
    );
  });
}

export interface RegisterEvidenceCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly inspectionItemId: string;
  readonly evidenceId: string;
  readonly createdAtDevice: string;
}

/**
 * Records that an evidence exists for an item, so RN-039 can be checked. The
 * file and its upload operation arrive with the camera (card #17).
 */
export async function registerEvidence(command: RegisterEvidenceCommand): Promise<void> {
  await writeTransaction(async (transaction) => {
    await lockInspection(transaction, command.ownerUserId, command.inspectionId, ['IN_PROGRESS']);
    await transaction.runAsync(
      `INSERT INTO evidences (id, inspection_id, inspection_item_id, created_at_device)
       VALUES (?, ?, ?, ?)`,
      command.evidenceId,
      command.inspectionId,
      command.inspectionItemId,
      command.createdAtDevice
    );
  });
}

export interface CompleteCommand {
  readonly ownerUserId: string;
  readonly inspectionId: string;
  readonly operationId: string;
  /** Device clock at the moment of the confirmation (RN-042). */
  readonly completedAtDevice: string;
  /** The single reading taken at the completion (card #19). */
  readonly location: LocationCapture;
}

/**
 * Document 10.14.4: the inspection is locked locally and the completion joins
 * the outbox after everything still owed for it, which it declares as
 * dependencies — the server must receive the answers before the submit.
 */
export async function completeInspection(command: CompleteCommand): Promise<void> {
  const now = command.completedAtDevice;

  await writeTransaction(async (transaction) => {
    const { base_version } = await lockInspection(
      transaction,
      command.ownerUserId,
      command.inspectionId,
      ['IN_PROGRESS']
    );
    const dependencyIds = await openOperationIds(transaction, command.inspectionId);

    await transaction.runAsync(
      `UPDATE inspections SET status = 'SUBMITTED', completed_at_device = ?,
              completion_latitude = ?, completion_longitude = ?, completion_accuracy = ?,
              completion_location_at = ?, completion_location_missing = ?
        WHERE id = ?`,
      command.completedAtDevice,
      ...locationColumns(command.location),
      command.inspectionId
    );
    await markInspectionDirty(transaction, command.inspectionId, now);
    await enqueueOperation(
      transaction,
      {
        operationId: command.operationId,
        ownerUserId: command.ownerUserId,
        entityType: 'INSPECTION',
        entityId: command.inspectionId,
        inspectionId: command.inspectionId,
        operationType: 'TRANSITION',
        baseVersion: base_version,
        payload: {
          action: 'SUBMIT',
          completedAtDevice: command.completedAtDevice,
          location: toLocationPayload(command.location),
        },
        dependencyIds,
      },
      now
    );
  });
}

/** Sync bookkeeping shown on the sync tab and the home screen. */
export async function recordSyncRun(
  ownerUserId: string,
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED',
  startedAt: string,
  finishedAt: string
): Promise<void> {
  await writeTransaction((transaction) =>
    transaction.runAsync(
      `INSERT INTO sync_metadata (owner_user_id, last_sync_started_at, last_sync_result, last_successful_sync)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (owner_user_id) DO UPDATE SET
       last_sync_started_at = excluded.last_sync_started_at,
       last_sync_result = excluded.last_sync_result,
       last_successful_sync = COALESCE(excluded.last_successful_sync, sync_metadata.last_successful_sync)`,
      ownerUserId,
      startedAt,
      result,
      result === 'SUCCESS' ? finishedAt : null
    )
  );
}

export async function readLastSuccessfulSync(ownerUserId: string): Promise<string | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ last_successful_sync: string | null }>(
    'SELECT last_successful_sync FROM sync_metadata WHERE owner_user_id = ?',
    ownerUserId
  );
  return row?.last_successful_sync ?? null;
}
