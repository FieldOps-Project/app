import type { SQLiteDatabase } from 'expo-sqlite';

import type { ChecklistResponse } from '@/domain/checklist';
import type { LocationCapture } from '@/domain/field-location';
import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import {
  completeInspection,
  findInspection,
  InspectionStateError,
  listInspectionSummaries,
  registerEvidence,
  saveDownloadedInspection,
  saveResponse,
  startInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  claimOperation,
  countOpenOperations,
  listOpenOperations,
  markCompleted,
  markFailed,
  reopenAfterRefusedSubmit,
} from '@/infrastructure/repositories/outbox-repository';
import type { MobileInspection } from '@/schemas/mobile-inspection';

jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';
const NOW = '2026-08-12T13:00:00.000Z';
const DENIED: LocationCapture = { status: 'missing', reason: 'PERMISSION_DENIED' };
const AT_GATE: LocationCapture = {
  status: 'captured',
  position: { latitude: -23.5012, longitude: -47.4531, accuracy: 18, capturedAt: NOW },
};

function remote(overrides: Partial<MobileInspection> = {}): MobileInspection {
  return {
    id: 'insp-1',
    title: 'Inspeção do gerador',
    status: 'ASSIGNED',
    priority: 'HIGH',
    scheduledFor: '2026-08-12T13:00:00Z',
    instructions: 'Desligar antes.',
    version: 3,
    updatedAt: 'v3',
    startedAtDevice: null,
    completedAtDevice: null,
    startLocation: null,
    completionLocation: null,
    client: { id: 'c-1', name: 'Indústria ABC' },
    site: { id: 's-1', name: 'Fábrica', addressLine: null, latitude: -23.5, longitude: -47.4 },
    equipment: null,
    items: [
      {
        id: 'item-1',
        sectionTitle: 'Geral',
        sectionDescription: null,
        sectionOrder: 1,
        itemCode: null,
        itemTitle: 'Proteção lateral',
        itemDescription: null,
        responseType: 'CONFORMITY',
        required: true,
        rules: {
          observationRequiredOnFailure: true,
          evidenceRequiredOnFailure: false,
          min: null,
          max: null,
        },
        options: [],
        itemOrder: 1,
      },
    ],
    responses: [],
    review: null,
    ...overrides,
  };
}

function answer(overrides: Partial<ChecklistResponse> = {}): ChecklistResponse {
  return {
    id: 'resp-1',
    inspectionItemId: 'item-1',
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: 'CONFORMING',
    observation: null,
    answeredAtDevice: NOW,
    ...overrides,
  };
}

let database: SQLiteDatabase;

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
});

async function started(location: LocationCapture = DENIED) {
  await saveDownloadedInspection(OWNER, remote(), NOW);
  await startInspection({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    operationId: 'op-start',
    startedAtDevice: NOW,
    location,
  });
}

describe('download', () => {
  it('stores the inspection, its snapshot and its answers for the technician only', async () => {
    await saveDownloadedInspection(OWNER, remote(), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.version).toBe(3);
    expect(stored?.detail.syncState).toBe('salvo-no-dispositivo');
    expect(stored?.items.map((item) => item.itemTitle)).toEqual(['Proteção lateral']);
    expect(await findInspection('someone-else', 'insp-1')).toBeNull();
    expect(await listInspectionSummaries('someone-else')).toEqual([]);
  });

  it('never overwrites local work not yet sent', async () => {
    await started();

    await saveDownloadedInspection(OWNER, remote({ status: 'ASSIGNED', title: 'Outro' }), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    expect(stored?.detail.syncState).toBe('aguardando-envio');
  });

  it('records a cancellation over local work without discarding it (RN-077)', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer(),
    });

    await saveDownloadedInspection(OWNER, remote({ status: 'CANCELED' }), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('CANCELED');
    expect(stored?.detail.syncState).toBe('conflito');
    expect(stored?.responses).toHaveLength(1);
    expect(await countOpenOperations(OWNER)).toBe(2);
  });

  it('keeps an answer edited on the device over the server copy', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer({ conformity: 'NON_CONFORMING', observation: 'Trinca.' }),
    });
    await database.runAsync('UPDATE inspections SET is_dirty = 0 WHERE id = ?', 'insp-1');

    await saveDownloadedInspection(
      OWNER,
      remote({ status: 'IN_PROGRESS', responses: [{ ...answer(), id: 'server-resp' }] }),
      NOW
    );

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]?.conformity).toBe('NON_CONFORMING');
  });
});

describe('start', () => {
  it('moves to IN_PROGRESS with the device time and queues the transition', async () => {
    await started();

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    expect(stored?.detail.startedAtDevice).toBe(NOW);

    const [operation] = await listOpenOperations(OWNER);
    expect(operation).toMatchObject({
      operationId: 'op-start',
      operationType: 'TRANSITION',
      baseVersion: 3,
      payload: { action: 'START', startedAtDevice: NOW, location: null },
    });
  });

  it('refuses a canceled inspection and leaves nothing behind', async () => {
    await saveDownloadedInspection(OWNER, remote({ status: 'CANCELED' }), NOW);

    await expect(
      startInspection({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-start',
        startedAtDevice: NOW,
        location: DENIED,
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
    expect(await countOpenOperations(OWNER)).toBe(0);
  });
});

describe('answers', () => {
  it('folds repeated edits of the same answer into one pending operation', async () => {
    await started();

    for (const conformity of ['CONFORMING', 'NON_CONFORMING', 'NOT_APPLICABLE'] as const) {
      await saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: `op-${conformity}`,
        response: answer({ conformity }),
      });
    }

    const operations = await listOpenOperations(OWNER);
    const answers = operations.filter((operation) => operation.entityType === 'RESPONSE');
    expect(answers).toHaveLength(1);
    expect(answers[0]?.operationId).toBe('op-CONFORMING');
    expect(answers[0]?.payload).toMatchObject({ conformity: 'NOT_APPLICABLE', baseVersion: 3 });
  });

  it('opens a new operation once the previous one is in flight', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-1',
      response: answer(),
    });
    await database.runAsync(
      "UPDATE sync_operations SET status = 'PROCESSING' WHERE operation_id = 'op-1'"
    );

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-2',
      response: answer({ conformity: 'NON_CONFORMING' }),
    });

    const ids = (await listOpenOperations(OWNER)).map((operation) => operation.operationId);
    expect(ids).toEqual(['op-start', 'op-1', 'op-2']);
  });

  it('refuses an answer before the start', async () => {
    await saveDownloadedInspection(OWNER, remote(), NOW);

    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op',
        response: answer(),
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
  });

  it('counts evidences per item', async () => {
    await started();
    await registerEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      evidenceId: 'ev-1',
      createdAtDevice: NOW,
    });

    expect((await findInspection(OWNER, 'insp-1'))?.evidenceCounts.get('item-1')).toBe(1);
  });
});

describe('completion', () => {
  it('locks the inspection and queues the submit after everything still owed', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer(),
    });

    await completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: NOW,
      location: DENIED,
    });

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('SUBMITTED');
    expect(stored?.detail.completedAtDevice).toBe(NOW);
    const submit = (await listOpenOperations(OWNER)).find((op) => op.operationId === 'op-submit');
    expect(submit?.dependencyIds).toEqual(['op-start', 'op-r']);
    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'x',
        response: answer(),
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
  });
});

describe('outbox results', () => {
  it('marks the records as sent once their last operation is confirmed', async () => {
    await started();
    const [start] = await listOpenOperations(OWNER);

    await markCompleted(start!, NOW);

    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('enviado');
    expect(await countOpenOperations(OWNER)).toBe(0);
  });

  it('keeps a refused operation in the queue and shows the failure', async () => {
    await started();
    const [start] = await listOpenOperations(OWNER);

    await markFailed(start!, 'FAILED', 'Valor inválido.', NOW);

    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('falha');
    expect(await listOpenOperations(OWNER)).toEqual([
      expect.objectContaining({ status: 'FAILED', lastError: 'Valor inválido.' }),
    ]);
  });
});

describe('claiming', () => {
  it('sends the payload as stored when claimed, not as it was listed', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer({ conformity: 'CONFORMING' }),
    });
    await listOpenOperations(OWNER);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-ignored',
      response: answer({ conformity: 'NON_CONFORMING', observation: 'Trinca.' }),
    });

    const claimed = await claimOperation('op-r', NOW);

    expect(claimed?.payload).toMatchObject({ conformity: 'NON_CONFORMING' });
    expect(await claimOperation('op-r', NOW)).toBeNull();
  });

  it('keeps an edit made during the send for the next run', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer(),
    });
    const claimed = await claimOperation('op-r', NOW);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r2',
      response: answer({ conformity: 'NOT_APPLICABLE' }),
    });

    await markCompleted(claimed!, NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]?.conformity).toBe('NOT_APPLICABLE');
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toContain('op-r2');
  });
});

describe('refused completion', () => {
  it('reopens the inspection for correction and drops the refused submit', async () => {
    await started();
    await completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: NOW,
      location: DENIED,
    });
    const submit = (await listOpenOperations(OWNER)).find((op) => op.operationId === 'op-submit');

    await reopenAfterRefusedSubmit(submit!, 'Item obrigatório sem resposta.', NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    expect(stored?.detail.completedAtDevice).toBeNull();
    expect(stored?.detail.completionLocation).toEqual({ status: 'not-recorded' });
    expect(stored?.detail.syncState).toBe('falha');
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toEqual(['op-start']);
  });
});

describe('location (card #19)', () => {
  it('saves the position read at the start and sends it with the transition', async () => {
    await started(AT_GATE);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.startLocation).toEqual(AT_GATE);
    const [start] = await listOpenOperations(OWNER);
    expect(start?.payload).toEqual({
      action: 'START',
      startedAtDevice: NOW,
      location: { latitude: -23.5012, longitude: -47.4531, accuracy: 18, capturedAt: NOW },
    });
  });

  it('keeps the reason for a missing position on the device and sends no coordinate', async () => {
    await started(DENIED);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.startLocation).toEqual(DENIED);
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    const [start] = await listOpenOperations(OWNER);
    expect(start?.payload).toEqual(expect.objectContaining({ location: null }));
  });

  it('records the completion position apart from the start one', async () => {
    await started(AT_GATE);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: answer(),
    });
    await completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: NOW,
      location: { status: 'missing', reason: 'TIMEOUT' },
    });

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.startLocation).toEqual(AT_GATE);
    expect(stored?.detail.completionLocation).toEqual({ status: 'missing', reason: 'TIMEOUT' });
  });

  it('keeps a captured position when the download does not report one', async () => {
    await started(AT_GATE);
    const [start] = await listOpenOperations(OWNER);
    await markCompleted((await claimOperation(start!.operationId, NOW))!, NOW);

    await saveDownloadedInspection(
      OWNER,
      remote({ status: 'IN_PROGRESS', startedAtDevice: NOW, startLocation: null }),
      NOW
    );

    expect((await findInspection(OWNER, 'insp-1'))?.detail.startLocation).toEqual(AT_GATE);
  });

  it('takes the position the server reports as a whole', async () => {
    await saveDownloadedInspection(
      OWNER,
      remote({
        status: 'IN_PROGRESS',
        startedAtDevice: NOW,
        startLocation: { latitude: -23.4, longitude: -47.3, accuracy: null, capturedAt: NOW },
      }),
      NOW
    );

    expect((await findInspection(OWNER, 'insp-1'))?.detail.startLocation).toEqual({
      status: 'captured',
      position: { latitude: -23.4, longitude: -47.3, accuracy: null, capturedAt: NOW },
    });
  });

  it('reads an inspection never started as having no position yet', async () => {
    await saveDownloadedInspection(OWNER, remote(), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.startLocation).toEqual({ status: 'not-recorded' });
    expect(stored?.detail.completionLocation).toEqual({ status: 'not-recorded' });
  });
});

describe('integrity', () => {
  it('enforces foreign keys on writes', async () => {
    await expect(
      database.runAsync(
        `INSERT INTO evidences (id, inspection_id, inspection_item_id, created_at_device)
         VALUES ('ev', 'missing', 'missing', ?)`,
        NOW
      )
    ).rejects.toThrow();
  });
});

describe('migrations', () => {
  it('records the schema version', async () => {
    expect(await database.getFirstAsync('PRAGMA user_version')).toEqual(
      expect.objectContaining({ user_version: 2 })
    );
  });
});
