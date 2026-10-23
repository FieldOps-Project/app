import type { ChecklistItem, ChecklistResponse, Conformity, ItemRules } from '@/domain/checklist';
import {
  isInspectionPriority,
  isInspectionStatus,
  type InspectionDetail,
  type InspectionReview,
  type InspectionSummary,
  type SyncState,
} from '@/domain/inspection';

/**
 * Raw SQLite rows and their translation into domain types. Repositories hand
 * out domain types only; no screen ever sees a row (card #21).
 */

export type LocalSyncStatus = 'SYNCED' | 'PENDING' | 'SYNCING' | 'ERROR' | 'CONFLICT';

export interface InspectionRow {
  id: string;
  owner_user_id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_for: string;
  instructions: string | null;
  client_id: string;
  client_name: string;
  site_id: string;
  site_name: string;
  site_address: string | null;
  site_latitude: number | null;
  site_longitude: number | null;
  equipment_id: string | null;
  equipment_name: string | null;
  equipment_qr_code: string | null;
  equipment_asset_number: string | null;
  equipment_serial_number: string | null;
  started_at_device: string | null;
  completed_at_device: string | null;
  review_json: string | null;
  base_version: number;
  local_sync_status: LocalSyncStatus;
  is_dirty: number;
  local_updated_at: string | null;
}

export interface ItemRow {
  id: string;
  section_title: string;
  section_description: string | null;
  section_order: number;
  item_code: string | null;
  item_title: string;
  item_description: string | null;
  response_type: string;
  required: number;
  rules_json: string;
  options_json: string;
  item_order: number;
}

export interface ResponseRow {
  id: string;
  inspection_item_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: number | null;
  value_date: string | null;
  conformity: Conformity | null;
  observation: string | null;
  answered_at_device: string;
}

/**
 * Collapses the stored sync status into the five states the technician reads
 * (document 13.8). A record downloaded and never touched is "salvo no
 * dispositivo"; once local work was confirmed by the server it is "enviado".
 */
export function toSyncState(status: LocalSyncStatus, localUpdatedAt: string | null): SyncState {
  switch (status) {
    case 'PENDING':
    case 'SYNCING':
      return 'aguardando-envio';
    case 'ERROR':
      return 'falha';
    case 'CONFLICT':
      return 'conflito';
    case 'SYNCED':
      return localUpdatedAt === null ? 'salvo-no-dispositivo' : 'enviado';
  }
}

function parseJson<TValue>(raw: string | null, fallback: TValue): TValue {
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as TValue;
  } catch {
    return fallback;
  }
}

/**
 * Values outside the enums can only come from a newer server; they degrade to
 * the most conservative reading instead of crashing the list.
 */
export function toSummary(row: InspectionRow): InspectionSummary {
  return {
    id: row.id,
    title: row.title,
    status: isInspectionStatus(row.status) ? row.status : 'CANCELED',
    priority: isInspectionPriority(row.priority) ? row.priority : 'MEDIUM',
    scheduledFor: row.scheduled_for,
    clientName: row.client_name,
    siteName: row.site_name,
    equipmentName: row.equipment_name,
    syncState: toSyncState(row.local_sync_status, row.local_updated_at),
  };
}

export function toDetail(row: InspectionRow): InspectionDetail {
  return {
    ...toSummary(row),
    instructions: row.instructions,
    version: row.base_version,
    client: { id: row.client_id, name: row.client_name },
    site: {
      id: row.site_id,
      name: row.site_name,
      addressLine: row.site_address,
      latitude: row.site_latitude,
      longitude: row.site_longitude,
    },
    equipment:
      row.equipment_id === null
        ? null
        : {
            id: row.equipment_id,
            name: row.equipment_name ?? '',
            qrCode: row.equipment_qr_code,
            assetNumber: row.equipment_asset_number,
            serialNumber: row.equipment_serial_number,
          },
    startedAtDevice: row.started_at_device,
    completedAtDevice: row.completed_at_device,
    review: parseJson<InspectionReview | null>(row.review_json, null),
  };
}

const DEFAULT_RULES: ItemRules = {
  observationRequiredOnFailure: false,
  evidenceRequiredOnFailure: false,
  min: null,
  max: null,
};

export function toChecklistItem(row: ItemRow): ChecklistItem {
  return {
    id: row.id,
    sectionTitle: row.section_title,
    sectionDescription: row.section_description,
    sectionOrder: row.section_order,
    itemCode: row.item_code,
    itemTitle: row.item_title,
    itemDescription: row.item_description,
    responseType: row.response_type,
    required: row.required === 1,
    rules: { ...DEFAULT_RULES, ...parseJson<Partial<ItemRules>>(row.rules_json, {}) },
    options: parseJson<string[]>(row.options_json, []),
    itemOrder: row.item_order,
  };
}

export function toChecklistResponse(row: ResponseRow): ChecklistResponse {
  return {
    id: row.id,
    inspectionItemId: row.inspection_item_id,
    valueText: row.value_text,
    valueNumber: row.value_number,
    valueBoolean: row.value_boolean === null ? null : row.value_boolean === 1,
    valueDate: row.value_date,
    conformity: row.conformity,
    observation: row.observation,
    answeredAtDevice: row.answered_at_device,
  };
}
