import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import {
  completeInspection,
  discardEvidence,
  findInspection,
  registerEvidence,
  saveDownloadedInspection,
  saveResponse,
  startInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  createNonConformity,
  deleteNonConformity,
  listNonConformities,
} from '@/infrastructure/repositories/non-conformity-repository';
import {
  NonConformityAnswerError,
  NonConformityEvidenceError,
  NonConformityItemError,
} from '@/infrastructure/repositories/non-conformity-errors';
import {
  countOpenOperations,
  listOpenOperations,
  markCompleted,
  claimOperation,
} from '@/infrastructure/repositories/outbox-repository';
import {
  checklistAnswer,
  FIXTURE_TIME,
  remoteInspection,
} from '@/infrastructure/repositories/testing/inspection-fixtures';

jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';

let database: SQLiteDatabase;

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
  await saveDownloadedInspection(OWNER, remoteInspection(), FIXTURE_TIME);
  await startInspection({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    operationId: 'op-start',
    startedAtDevice: FIXTURE_TIME,
    location: { status: 'missing', reason: 'PERMISSION_DENIED' },
  });
  await saveResponse({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    operationId: 'op-answer',
    response: checklistAnswer({ conformity: 'NON_CONFORMING', observation: 'Trinca.' }),
  });
});

async function create(overrides: Partial<Parameters<typeof createNonConformity>[0]> = {}) {
  await createNonConformity({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    inspectionItemId: 'item-1',
    nonConformityId: 'nc-1',
    operationId: 'op-nc',
    createdAtDevice: FIXTURE_TIME,
    title: 'Trinca na proteção',
    description: 'Trinca de 5 cm na proteção lateral.',
    severity: 'HIGH',
    ...overrides,
  });
}

async function attachPhoto(evidenceId: string, nonConformityId: string | undefined) {
  await registerEvidence({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    inspectionItemId: 'item-1',
    nonConformityId,
    evidenceId,
    createdAtDevice: FIXTURE_TIME,
    file: {
      operationId: `op-${evidenceId}`,
      photoPath: `${evidenceId}.jpg`,
      thumbnailPath: `${evidenceId}-t.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    },
  });
}

describe('createNonConformity', () => {
  it('links the item, the answer and the inspection by itself', async () => {
    await create();

    const [stored] = await listNonConformities(OWNER, 'insp-1');
    expect(stored).toMatchObject({
      id: 'nc-1',
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      itemTitle: 'Proteção lateral',
      severity: 'HIGH',
      evidenceCount: 0,
      syncState: 'aguardando-envio',
    });
    const row = await database.getFirstAsync<{ response_id: string }>(
      'SELECT response_id FROM non_conformities WHERE id = ?',
      'nc-1'
    );
    expect(row?.response_id).toBe('resp-1');
  });

  it('queues one operation that waits for the answer, with a device-made id', async () => {
    await create();

    const operation = (await listOpenOperations(OWNER)).find(
      (entry) => entry.entityType === 'NON_CONFORMITY'
    );
    expect(operation).toMatchObject({
      operationId: 'op-nc',
      operationType: 'CREATE',
      dependencyIds: ['op-answer'],
      payload: expect.objectContaining({
        id: 'nc-1',
        responseId: 'resp-1',
        severity: 'HIGH',
        status: 'OPEN',
      }),
    });
  });

  it('refuses an item of another inspection and leaves nothing behind', async () => {
    const before = await countOpenOperations(OWNER);

    await expect(create({ inspectionItemId: 'item-of-another-inspection' })).rejects.toBeInstanceOf(
      NonConformityItemError
    );

    expect(await listNonConformities(OWNER, 'insp-1')).toEqual([]);
    expect(await countOpenOperations(OWNER)).toBe(before);
  });

  it('refuses an item that has not been answered, so the link to the answer never goes stale', async () => {
    await database.runAsync('DELETE FROM inspection_responses');
    const before = await countOpenOperations(OWNER);

    await expect(create()).rejects.toBeInstanceOf(NonConformityAnswerError);

    expect(await listNonConformities(OWNER, 'insp-1')).toEqual([]);
    expect(await countOpenOperations(OWNER)).toBe(before);
  });

  it('refuses a registration once the inspection is no longer in progress', async () => {
    await database.runAsync(`UPDATE inspections SET status = 'SUBMITTED' WHERE id = 'insp-1'`);

    await expect(create()).rejects.toThrow('não está em um estado');

    expect(await listNonConformities(OWNER, 'insp-1')).toEqual([]);
  });

  it('is private to the technician who owns the inspection', async () => {
    await create();

    expect(await listNonConformities('someone-else', 'insp-1')).toEqual([]);
  });

  it('reads back, from the database, what was registered', async () => {
    await create();

    const reopened = await listNonConformities(OWNER, 'insp-1');

    expect(reopened.map((entry) => entry.id)).toEqual(['nc-1']);
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('aguardando-envio');
  });
});

describe('evidence of a non-conformity', () => {
  it('counts the photos attached to it, and only those', async () => {
    await create();
    await attachPhoto('ev-nc', 'nc-1');
    await attachPhoto('ev-item', undefined);

    const [stored] = await listNonConformities(OWNER, 'insp-1');
    expect(stored?.evidenceCount).toBe(1);
  });

  it('makes the photo upload wait for the non-conformity as well as for the answer', async () => {
    await create();
    await attachPhoto('ev-nc', 'nc-1');

    const upload = (await listOpenOperations(OWNER)).find(
      (entry) => entry.entityType === 'EVIDENCE'
    );
    expect(upload?.dependencyIds).toEqual(expect.arrayContaining(['op-answer', 'op-nc']));
    expect(upload?.payload).toMatchObject({ nonConformityId: 'nc-1' });
  });
});

describe('photo of a non-conformity', () => {
  it.each([
    ['one that does not exist', 'ghost'],
    ['one of another item', 'nc-other-item'],
  ])('refuses %s and stores nothing', async (_name, nonConformityId) => {
    await create();
    await database.runAsync(
      `INSERT INTO non_conformities (id, inspection_id, inspection_item_id, title, description, severity, created_at_device)
       VALUES ('nc-other-item', 'insp-1', NULL, 'x', 'y', 'LOW', ?)`,
      FIXTURE_TIME
    );

    await expect(attachPhoto('ev-bad', nonConformityId)).rejects.toBeInstanceOf(
      NonConformityItemError
    );

    const photos = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM evidences'
    );
    expect(photos?.total).toBe(0);
  });
});

describe('completing with a critical non-conformity (RN-055)', () => {
  const complete = () =>
    completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: FIXTURE_TIME,
      location: { status: 'missing', reason: 'PERMISSION_DENIED' },
    });

  it('refuses while a critical registration has no photo, and changes nothing', async () => {
    await create({ severity: 'CRITICAL' });

    await expect(complete()).rejects.toBeInstanceOf(NonConformityEvidenceError);

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('IN_PROGRESS');
    expect((await listOpenOperations(OWNER)).map((entry) => entry.operationId)).not.toContain(
      'op-submit'
    );
  });

  it('completes once the critical registration has its photo', async () => {
    await create({ severity: 'CRITICAL' });
    await attachPhoto('ev-nc', 'nc-1');

    await complete();

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('SUBMITTED');
  });

  it('refuses again when the only photo is discarded', async () => {
    await create({ severity: 'CRITICAL' });
    await attachPhoto('ev-nc', 'nc-1');
    await discardEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      evidenceId: 'ev-nc',
      operationId: 'op-discard',
      discardedAtDevice: FIXTURE_TIME,
    });

    await expect(complete()).rejects.toBeInstanceOf(NonConformityEvidenceError);
  });

  it('never asks for a photo of a less severe registration', async () => {
    await create({ severity: 'HIGH' });

    await complete();

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('SUBMITTED');
  });
});

describe('deleteNonConformity', () => {
  it('removes a pending registration with its photos and cancels what was queued', async () => {
    await create();
    await attachPhoto('ev-nc', 'nc-1');

    const result = await deleteNonConformity({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      nonConformityId: 'nc-1',
      deletedAtDevice: FIXTURE_TIME,
    });

    expect(result).toEqual({ outcome: 'removed', files: ['ev-nc.jpg', 'ev-nc-t.jpg'] });
    expect(await listNonConformities(OWNER, 'insp-1')).toEqual([]);
    const left = (await listOpenOperations(OWNER)).map((entry) => entry.entityType);
    expect(left).toEqual(['INSPECTION', 'RESPONSE']);
    const photos = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM evidences'
    );
    expect(photos?.total).toBe(0);
  });

  it('keeps the photos of the item itself', async () => {
    await create();
    await attachPhoto('ev-item', undefined);

    await deleteNonConformity({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      nonConformityId: 'nc-1',
      deletedAtDevice: FIXTURE_TIME,
    });

    const photos = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM evidences'
    );
    expect(photos?.total).toBe(1);
  });

  it('never deletes what the server already has (RN-056)', async () => {
    await create();
    await attachPhoto('ev-nc', 'nc-1');
    const claimed = await claimOperation('op-nc', FIXTURE_TIME);
    if (claimed === null) {
      throw new Error('A operação não foi reservada.');
    }
    await markCompleted(claimed, FIXTURE_TIME);

    const result = await deleteNonConformity({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      nonConformityId: 'nc-1',
      deletedAtDevice: FIXTURE_TIME,
    });

    expect(result).toEqual({ outcome: 'already-sent' });
    const [kept] = await listNonConformities(OWNER, 'insp-1');
    expect(kept?.evidenceCount).toBe(1);
  });

  it('answers not-found for a registration that does not exist', async () => {
    const result = await deleteNonConformity({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      nonConformityId: 'ghost',
      deletedAtDevice: FIXTURE_TIME,
    });

    expect(result).toEqual({ outcome: 'not-found' });
  });
});
