import type { AnswerValues } from '@/domain/answer-summary';
import { getDatabase } from '@/infrastructure/database/database';
import { pulledResponseSchema } from '@/schemas/sync-pull';

export interface ConflictingRecord {
  readonly operationId: string;
  readonly entityType: string;
  readonly itemTitle: string | null;
  readonly message: string | null;
  readonly local: AnswerValues | null;
  readonly server: AnswerValues | null;
}

interface ConflictRow {
  operation_id: string;
  entity_type: string;
  last_error: string | null;
  server_state_json: string | null;
  item_title: string | null;
  response_id: string | null;
  value_text: string | null;
  value_number: number | null;
  value_boolean: number | null;
  value_date: string | null;
  conformity: AnswerValues['conformity'];
  observation: string | null;
}

function parseServerSide(json: string | null): AnswerValues | null {
  if (json === null) {
    return null;
  }
  try {
    const parsed = pulledResponseSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function listConflicts(
  ownerUserId: string,
  inspectionId: string
): Promise<ConflictingRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ConflictRow>(
    `SELECT o.operation_id, o.entity_type, o.last_error, o.server_state_json,
            items.item_title, r.id AS response_id, r.value_text, r.value_number,
            r.value_boolean, r.value_date, r.conformity, r.observation
       FROM sync_operations o
       LEFT JOIN inspection_responses r ON o.entity_type = 'RESPONSE' AND r.id = o.entity_id
       LEFT JOIN inspection_items items ON items.id = r.inspection_item_id
      WHERE o.owner_user_id = ? AND o.inspection_id = ? AND o.status = 'CONFLICT'
      ORDER BY o.created_at`,
    ownerUserId,
    inspectionId
  );

  return rows.map((row) => ({
    operationId: row.operation_id,
    entityType: row.entity_type,
    itemTitle: row.item_title,
    message: row.last_error,
    local:
      row.response_id === null
        ? null
        : {
            valueText: row.value_text,
            valueNumber: row.value_number,
            valueBoolean: row.value_boolean === null ? null : row.value_boolean === 1,
            valueDate: row.value_date,
            conformity: row.conformity,
            observation: row.observation,
          },
    server: parseServerSide(row.server_state_json),
  }));
}
