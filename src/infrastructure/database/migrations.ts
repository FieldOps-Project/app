/**
 * Versioned local schema (documents 10.13 and 10.14).
 *
 * The device holds work that may not have reached the server yet, so the
 * schema only ever moves forward: each entry runs once, in order, inside the
 * same transaction that records the new version. Never edit a published entry —
 * append a new one. Dropping the database to "fix" a schema would throw away
 * field work (RN-066).
 *
 * Business status and sync status are separate columns (document 10.2): an
 * inspection can be IN_PROGRESS and PENDING at the same time.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE inspections (
    id                      TEXT PRIMARY KEY NOT NULL,
    owner_user_id           TEXT NOT NULL,
    title                   TEXT NOT NULL,
    status                  TEXT NOT NULL,
    priority                TEXT NOT NULL,
    scheduled_for           TEXT NOT NULL,
    instructions            TEXT,
    client_id               TEXT NOT NULL,
    client_name             TEXT NOT NULL,
    site_id                 TEXT NOT NULL,
    site_name               TEXT NOT NULL,
    site_address            TEXT,
    site_latitude           REAL,
    site_longitude          REAL,
    equipment_id            TEXT,
    equipment_name          TEXT,
    equipment_qr_code       TEXT,
    equipment_asset_number  TEXT,
    equipment_serial_number TEXT,
    started_at_device       TEXT,
    completed_at_device     TEXT,
    review_json             TEXT,
    server_updated_at       TEXT,
    base_version            INTEGER NOT NULL,
    local_sync_status       TEXT NOT NULL DEFAULT 'SYNCED'
      CHECK (local_sync_status IN ('SYNCED', 'PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    is_dirty                INTEGER NOT NULL DEFAULT 0,
    last_synced_at          TEXT,
    local_updated_at        TEXT,
    sync_error              TEXT
  );
  CREATE INDEX ix_inspections_owner_status ON inspections (owner_user_id, status, scheduled_for);

  CREATE TABLE inspection_items (
    id                  TEXT PRIMARY KEY NOT NULL,
    inspection_id       TEXT NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    section_title       TEXT NOT NULL,
    section_description TEXT,
    section_order       INTEGER NOT NULL,
    item_code           TEXT,
    item_title          TEXT NOT NULL,
    item_description    TEXT,
    response_type       TEXT NOT NULL,
    required            INTEGER NOT NULL,
    rules_json          TEXT NOT NULL,
    options_json        TEXT NOT NULL,
    item_order          INTEGER NOT NULL
  );
  CREATE INDEX ix_items_order ON inspection_items (inspection_id, section_order, item_order);

  CREATE TABLE inspection_responses (
    id                 TEXT PRIMARY KEY NOT NULL,
    inspection_id      TEXT NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    inspection_item_id TEXT NOT NULL UNIQUE REFERENCES inspection_items (id) ON DELETE CASCADE,
    value_text         TEXT,
    value_number       REAL,
    value_boolean      INTEGER,
    value_date         TEXT,
    conformity         TEXT
      CHECK (conformity IS NULL OR conformity IN ('CONFORMING', 'NON_CONFORMING', 'NOT_APPLICABLE')),
    observation        TEXT,
    answered_at_device TEXT NOT NULL,
    base_version       INTEGER NOT NULL,
    local_sync_status  TEXT NOT NULL DEFAULT 'SYNCED'
      CHECK (local_sync_status IN ('SYNCED', 'PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    is_dirty           INTEGER NOT NULL DEFAULT 0,
    last_synced_at     TEXT,
    local_updated_at   TEXT,
    sync_error         TEXT
  );
  CREATE INDEX ix_responses_inspection ON inspection_responses (inspection_id);

  CREATE TABLE evidences (
    id                 TEXT PRIMARY KEY NOT NULL,
    inspection_id      TEXT NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    inspection_item_id TEXT NOT NULL REFERENCES inspection_items (id) ON DELETE CASCADE,
    local_uri          TEXT,
    created_at_device  TEXT NOT NULL,
    local_sync_status  TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (local_sync_status IN ('SYNCED', 'PENDING', 'SYNCING', 'ERROR', 'CONFLICT'))
  );
  CREATE INDEX ix_evidences_item ON evidences (inspection_id, inspection_item_id);

  CREATE TABLE sync_operations (
    operation_id    TEXT PRIMARY KEY NOT NULL,
    owner_user_id   TEXT NOT NULL,
    entity_type     TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    inspection_id   TEXT NOT NULL,
    operation_type  TEXT NOT NULL
      CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE_LOGICAL', 'TRANSITION', 'UPLOAD')),
    base_version    INTEGER NOT NULL,
    payload_json    TEXT NOT NULL,
    dependency_ids  TEXT NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING', 'PROCESSING', 'FAILED', 'CONFLICT', 'COMPLETED')),
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_attempt_at TEXT,
    completed_at    TEXT
  );
  CREATE INDEX ix_sync_operations_status ON sync_operations (owner_user_id, status, created_at);
  CREATE INDEX ix_sync_operations_entity ON sync_operations (entity_type, entity_id, status);

  CREATE TABLE sync_metadata (
    owner_user_id        TEXT PRIMARY KEY NOT NULL,
    last_pull_at         TEXT,
    last_sync_started_at TEXT,
    last_successful_sync TEXT,
    last_sync_result     TEXT CHECK (last_sync_result IS NULL OR last_sync_result IN ('SUCCESS', 'PARTIAL', 'FAILED'))
  );
  `,
  // Card #19: the position read at the start and at the completion (RN-062).
  // Without a position the coordinates stay empty and `*_location_missing`
  // keeps the reason; nothing is ever approximated.
  `
  ALTER TABLE inspections ADD COLUMN start_latitude REAL;
  ALTER TABLE inspections ADD COLUMN start_longitude REAL;
  ALTER TABLE inspections ADD COLUMN start_accuracy REAL;
  ALTER TABLE inspections ADD COLUMN start_location_at TEXT;
  ALTER TABLE inspections ADD COLUMN start_location_missing TEXT;
  ALTER TABLE inspections ADD COLUMN completion_latitude REAL;
  ALTER TABLE inspections ADD COLUMN completion_longitude REAL;
  ALTER TABLE inspections ADD COLUMN completion_accuracy REAL;
  ALTER TABLE inspections ADD COLUMN completion_location_at TEXT;
  ALTER TABLE inspections ADD COLUMN completion_location_missing TEXT;
  `,
  // Cards #21 and #23: the rest of document 10.13.
  //
  // - Non-conformities get their own table (document 10.10), ready for card #20.
  // - Evidences take the fields of document 10.9 and the local sync metadata
  //   of 10.13.2. An evidence may belong to the inspection alone, so the item
  //   becomes optional; SQLite cannot relax NOT NULL in place, so the table is
  //   rebuilt and every row already on the device is copied over.
  // - `deleted_locally` marks a removal the server has not confirmed yet.
  // - Indexes follow the queries the app runs: the list ordered by schedule,
  //   the QR lookup (card #18), the operations owed per inspection, and the
  //   evidence links of document 10.15.2.
  `
  CREATE TABLE non_conformities (
    id                 TEXT PRIMARY KEY NOT NULL,
    inspection_id      TEXT NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    inspection_item_id TEXT REFERENCES inspection_items (id) ON DELETE CASCADE,
    response_id        TEXT REFERENCES inspection_responses (id) ON DELETE SET NULL,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL,
    severity           TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status             TEXT NOT NULL DEFAULT 'OPEN',
    created_at_device  TEXT NOT NULL,
    base_version       INTEGER NOT NULL DEFAULT 0,
    local_sync_status  TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (local_sync_status IN ('SYNCED', 'PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    is_dirty           INTEGER NOT NULL DEFAULT 1,
    last_synced_at     TEXT,
    local_updated_at   TEXT,
    sync_error         TEXT,
    deleted_locally    INTEGER NOT NULL DEFAULT 0 CHECK (deleted_locally IN (0, 1))
  );
  CREATE INDEX ix_non_conformities_inspection ON non_conformities (inspection_id, inspection_item_id);

  CREATE TABLE evidences_v3 (
    id                 TEXT PRIMARY KEY NOT NULL,
    inspection_id      TEXT NOT NULL REFERENCES inspections (id) ON DELETE CASCADE,
    inspection_item_id TEXT REFERENCES inspection_items (id) ON DELETE CASCADE,
    response_id        TEXT REFERENCES inspection_responses (id) ON DELETE SET NULL,
    non_conformity_id  TEXT REFERENCES non_conformities (id) ON DELETE SET NULL,
    type               TEXT NOT NULL DEFAULT 'PHOTO' CHECK (type IN ('PHOTO')),
    local_uri          TEXT,
    storage_key        TEXT,
    original_file_name TEXT,
    mime_type          TEXT,
    size_bytes         INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
    checksum           TEXT,
    description        TEXT,
    latitude           REAL,
    longitude          REAL,
    created_at_device  TEXT NOT NULL,
    uploaded_at        TEXT,
    base_version       INTEGER NOT NULL DEFAULT 0,
    local_sync_status  TEXT NOT NULL DEFAULT 'PENDING'
      CHECK (local_sync_status IN ('SYNCED', 'PENDING', 'SYNCING', 'ERROR', 'CONFLICT')),
    is_dirty           INTEGER NOT NULL DEFAULT 1,
    last_synced_at     TEXT,
    local_updated_at   TEXT,
    sync_error         TEXT,
    deleted_locally    INTEGER NOT NULL DEFAULT 0 CHECK (deleted_locally IN (0, 1))
  );
  INSERT INTO evidences_v3 (
    id, inspection_id, inspection_item_id, local_uri, created_at_device, local_sync_status,
    local_updated_at
  )
  SELECT id, inspection_id, inspection_item_id, local_uri, created_at_device, local_sync_status,
         created_at_device
    FROM evidences;
  DROP TABLE evidences;
  ALTER TABLE evidences_v3 RENAME TO evidences;
  CREATE INDEX ix_evidences_item ON evidences (inspection_id, inspection_item_id);
  CREATE INDEX ix_evidences_response ON evidences (response_id);
  CREATE INDEX ix_evidences_non_conformity ON evidences (non_conformity_id);

  ALTER TABLE inspection_responses ADD COLUMN deleted_locally INTEGER NOT NULL DEFAULT 0
    CHECK (deleted_locally IN (0, 1));

  CREATE INDEX ix_inspections_owner_schedule ON inspections (owner_user_id, scheduled_for, id);
  CREATE INDEX ix_inspections_owner_qr ON inspections (owner_user_id, equipment_qr_code);
  CREATE INDEX ix_sync_operations_inspection ON sync_operations (inspection_id, status);
  `,
];
