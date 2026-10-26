import {
  toChecklistItem,
  toChecklistResponse,
  toSummary,
  toRecordedLocation,
  toSyncState,
  type InspectionRow,
} from '@/infrastructure/repositories/inspection-rows';

const ROW: InspectionRow = {
  id: 'insp-1',
  owner_user_id: 'u-1',
  title: 'Inspeção',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  scheduled_for: '2026-08-12T13:00:00Z',
  instructions: null,
  client_id: 'c-1',
  client_name: 'Indústria ABC',
  site_id: 's-1',
  site_name: 'Fábrica',
  site_address: null,
  site_latitude: null,
  site_longitude: null,
  equipment_id: null,
  equipment_name: null,
  equipment_qr_code: null,
  equipment_asset_number: null,
  equipment_serial_number: null,
  started_at_device: null,
  completed_at_device: null,
  review_json: null,
  start_latitude: null,
  start_longitude: null,
  start_accuracy: null,
  start_location_at: null,
  start_location_missing: null,
  completion_latitude: null,
  completion_longitude: null,
  completion_accuracy: null,
  completion_location_at: null,
  completion_location_missing: null,
  base_version: 1,
  local_sync_status: 'PENDING',
  is_dirty: 1,
  local_updated_at: '2026-08-12T13:05:00Z',
  sync_error: null,
};

describe('toSyncState', () => {
  it('tells a downloaded record apart from one whose local work was sent (document 13.8)', () => {
    expect(toSyncState('SYNCED', null)).toBe('salvo-no-dispositivo');
    expect(toSyncState('SYNCED', '2026-08-12T13:05:00Z')).toBe('enviado');
  });

  it('maps the remaining states', () => {
    expect(toSyncState('PENDING', null)).toBe('aguardando-envio');
    expect(toSyncState('SYNCING', null)).toBe('aguardando-envio');
    expect(toSyncState('ERROR', null)).toBe('falha');
    expect(toSyncState('CONFLICT', null)).toBe('conflito');
  });
});

describe('toSummary', () => {
  it('keeps the business status and the sync state as separate fields', () => {
    const summary = toSummary(ROW);

    expect(summary.status).toBe('IN_PROGRESS');
    expect(summary.syncState).toBe('aguardando-envio');
  });

  it('reads a status from a newer server as the most conservative one', () => {
    expect(toSummary({ ...ROW, status: 'ARCHIVED' }).status).toBe('CANCELED');
  });
});

describe('toChecklistItem', () => {
  it('fills rules missing from older snapshots', () => {
    const item = toChecklistItem({
      id: 'i-1',
      section_title: 'Geral',
      section_description: null,
      section_order: 1,
      item_code: null,
      item_title: 'Item',
      item_description: null,
      response_type: 'SINGLE_CHOICE',
      required: 1,
      rules_json: '{}',
      options_json: '["A","B"]',
      item_order: 1,
    });

    expect(item.required).toBe(true);
    expect(item.options).toEqual(['A', 'B']);
    expect(item.rules.observationRequiredOnFailure).toBe(false);
  });
});

describe('toChecklistResponse', () => {
  it('turns the stored integer back into a boolean, keeping null as unanswered', () => {
    const base = {
      id: 'r-1',
      inspection_item_id: 'i-1',
      value_text: null,
      value_number: null,
      value_date: null,
      conformity: null,
      observation: null,
      answered_at_device: '2026-08-12T13:05:00Z',
    };

    expect(toChecklistResponse({ ...base, value_boolean: 0 }).valueBoolean).toBe(false);
    expect(toChecklistResponse({ ...base, value_boolean: 1 }).valueBoolean).toBe(true);
    expect(toChecklistResponse({ ...base, value_boolean: null }).valueBoolean).toBeNull();
  });
});

describe('toRecordedLocation', () => {
  it('reads a full coordinate pair as captured', () => {
    expect(toRecordedLocation(-23.5, -47.4, 12, '2026-08-12T13:00:00Z', null)).toEqual({
      status: 'captured',
      position: {
        latitude: -23.5,
        longitude: -47.4,
        accuracy: 12,
        capturedAt: '2026-08-12T13:00:00Z',
      },
    });
  });

  it('reads the stored reason when there is no coordinate', () => {
    expect(toRecordedLocation(null, null, null, null, 'TIMEOUT')).toEqual({
      status: 'missing',
      reason: 'TIMEOUT',
    });
  });

  it('never reads half a coordinate as a position', () => {
    expect(toRecordedLocation(-23.5, null, null, '2026-08-12T13:00:00Z', null)).toEqual({
      status: 'not-recorded',
    });
  });

  it('degrades an unknown reason to "unavailable"', () => {
    expect(toRecordedLocation(null, null, null, null, 'SOMETHING_NEW')).toEqual({
      status: 'missing',
      reason: 'UNAVAILABLE',
    });
  });
});
