/// <reference types="node" />

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { SQLiteDatabase } from 'expo-sqlite';

import type { LocationCapture } from '@/domain/field-location';
import { getDatabase, migrate, readSchemaVersion } from '@/infrastructure/database/database';
import { MIGRATIONS } from '@/infrastructure/database/migrations';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import {
  checkCompletable,
  completeInspection,
  discardEvidence,
  findInspection,
  InspectionStateError,
  listInspectionSummaries,
  recordEquipmentDivergence,
  recordResponseVersion,
  registerEvidence,
  reopenInspection,
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
  releaseInterruptedOperations,
  releaseOperation,
  reopenAfterRefusedSubmit,
  sanitizeSyncError,
} from '@/infrastructure/repositories/outbox-repository';
import {
  InspectionIncompleteError,
  InvalidResponseError,
  ItemNotCorrectableError,
} from '@/infrastructure/repositories/inspection-errors';
import {
  createNonConformity,
  deleteNonConformity,
} from '@/infrastructure/repositories/non-conformity-repository';
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
const NOW = FIXTURE_TIME;
const DENIED: LocationCapture = { status: 'missing', reason: 'PERMISSION_DENIED' };
const AT_GATE: LocationCapture = {
  status: 'captured',
  position: { latitude: -23.5012, longitude: -47.4531, accuracy: 18, capturedAt: NOW },
};

let database: SQLiteDatabase;

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
});

async function started(location: LocationCapture = DENIED) {
  await saveDownloadedInspection(OWNER, remoteInspection(), NOW);
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
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.version).toBe(3);
    expect(stored?.detail.syncState).toBe('salvo-no-dispositivo');
    expect(stored?.items.map((item) => item.itemTitle)).toEqual(['Proteção lateral']);
    expect(await findInspection('someone-else', 'insp-1')).toBeNull();
    expect(await listInspectionSummaries('someone-else')).toEqual([]);
  });

  it('never overwrites local work not yet sent', async () => {
    await started();

    await saveDownloadedInspection(
      OWNER,
      remoteInspection({ status: 'ASSIGNED', title: 'Outro' }),
      NOW
    );

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
      response: checklistAnswer(),
    });

    await saveDownloadedInspection(OWNER, remoteInspection({ status: 'CANCELED' }), NOW);

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
      response: checklistAnswer({ conformity: 'NON_CONFORMING', observation: 'Trinca.' }),
    });
    await database.runAsync('UPDATE inspections SET is_dirty = 0 WHERE id = ?', 'insp-1');

    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        status: 'IN_PROGRESS',
        responses: [{ ...checklistAnswer(), id: 'server-resp' }],
      }),
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
    await saveDownloadedInspection(OWNER, remoteInspection({ status: 'CANCELED' }), NOW);

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
        response: checklistAnswer({ conformity }),
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
      response: checklistAnswer(),
    });
    await database.runAsync(
      "UPDATE sync_operations SET status = 'PROCESSING' WHERE operation_id = 'op-1'"
    );

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-2',
      response: checklistAnswer({ conformity: 'NON_CONFORMING' }),
    });

    const ids = (await listOpenOperations(OWNER)).map((operation) => operation.operationId);
    expect(ids).toEqual(['op-start', 'op-1', 'op-2']);
  });

  it('refuses an answer before the start', async () => {
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op',
        response: checklistAnswer(),
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
  });

  it('lists the evidences of each item with their thumbnail and pending state', async () => {
    await started();
    for (const id of ['ev-1', 'ev-2']) {
      await registerEvidence({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        inspectionItemId: 'item-1',
        evidenceId: id,
        createdAtDevice: NOW,
        file: {
          operationId: `op-${id}`,
          photoPath: `evidences/insp-1/${id}.jpg`,
          thumbnailPath: `evidences/insp-1/${id}-thumb.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 150_000,
          description: id === 'ev-1' ? 'Trinca na base' : null,
        },
      });
    }

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.evidenceCounts.get('item-1')).toBe(2);
    expect(stored?.evidences['item-1']).toEqual([
      {
        id: 'ev-1',
        inspectionItemId: 'item-1',
        photoPath: 'evidences/insp-1/ev-1.jpg',
        thumbnailPath: 'evidences/insp-1/ev-1-thumb.jpg',
        description: 'Trinca na base',
        createdAtDevice: NOW,
        syncState: 'aguardando-envio',
      },
      expect.objectContaining({ id: 'ev-2', description: null }),
    ]);
  });
});

describe('completion', () => {
  it('locks the inspection and queues the submit after everything still owed', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
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
        response: checklistAnswer(),
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
      response: checklistAnswer({ conformity: 'CONFORMING' }),
    });
    await listOpenOperations(OWNER);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-ignored',
      response: checklistAnswer({ conformity: 'NON_CONFORMING', observation: 'Trinca.' }),
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
      response: checklistAnswer(),
    });
    const claimed = await claimOperation('op-r', NOW);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r2',
      response: checklistAnswer({ conformity: 'NOT_APPLICABLE' }),
    });

    await markCompleted(claimed!, NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]?.conformity).toBe('NOT_APPLICABLE');
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toContain('op-r2');
  });
});

describe('checking completion before the GPS wait', () => {
  it('refuses an incomplete checklist without writing anything', async () => {
    await started();

    await expect(checkCompletable(OWNER, 'insp-1')).rejects.toBeInstanceOf(
      InspectionIncompleteError
    );
    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('IN_PROGRESS');
  });

  it('lets a complete checklist through and leaves completing to the real command', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });

    await expect(checkCompletable(OWNER, 'insp-1')).resolves.toBeUndefined();
    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('IN_PROGRESS');
  });

  it('refuses an inspection that is not in progress', async () => {
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

    await expect(checkCompletable(OWNER, 'insp-1')).rejects.toBeInstanceOf(InspectionStateError);
  });
});

describe('completion guards (RN-037, RN-038, RN-039)', () => {
  const complete = () =>
    completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: NOW,
      location: DENIED,
    });

  async function expectRefusedAndUntouched() {
    await expect(complete()).rejects.toBeInstanceOf(InspectionIncompleteError);

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('IN_PROGRESS');
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).not.toContain(
      'op-submit'
    );
  }

  it('refuses while a required item has no answer, whoever calls it', async () => {
    await started();

    await expectRefusedAndUntouched();
  });

  it('refuses a non-conforming answer that lacks the observation the item asks for', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer({ conformity: 'NON_CONFORMING', observation: null }),
    });

    await expectRefusedAndUntouched();
  });

  it('refuses a non-conforming answer that lacks the evidence the item asks for', async () => {
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        items: [
          {
            ...remoteInspection().items[0]!,
            rules: {
              observationRequiredOnFailure: false,
              evidenceRequiredOnFailure: true,
              min: null,
              max: null,
            },
          },
        ],
      }),
      NOW
    );
    await startInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-start',
      startedAtDevice: NOW,
      location: DENIED,
    });
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer({ conformity: 'NON_CONFORMING' }),
    });

    await expectRefusedAndUntouched();
  });

  it('completes once everything required is answered', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });

    await complete();

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('SUBMITTED');
  });
});

describe('answer integrity (RN-035, RN-036)', () => {
  it('refuses a value that does not fit the type of the item, and stores nothing', async () => {
    await started();

    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-r',
        response: checklistAnswer({ conformity: null, valueText: 'qualquer coisa' }),
      })
    ).rejects.toBeInstanceOf(InvalidResponseError);

    expect((await findInspection(OWNER, 'insp-1'))?.responses).toEqual([]);
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toEqual(['op-start']);
  });

  it('refuses an answer to an item that is not in this inspection', async () => {
    await started();

    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-r',
        response: checklistAnswer({ inspectionItemId: 'item-of-another-inspection' }),
      })
    ).rejects.toThrow('Este item não pertence a esta inspeção.');
  });
});

describe('evidence of a locked inspection (RN-049)', () => {
  async function completed() {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });
    await registerEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      evidenceId: 'ev-1',
      createdAtDevice: NOW,
      file: {
        operationId: 'op-ev',
        photoPath: 'ev-1.jpg',
        thumbnailPath: 'ev-1-t.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      },
    });
    await completeInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-submit',
      completedAtDevice: NOW,
      location: DENIED,
    });
  }

  it('refuses a new photo and the removal of an existing one once the inspection is completed', async () => {
    await completed();

    await expect(
      registerEvidence({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        inspectionItemId: 'item-1',
        evidenceId: 'ev-2',
        createdAtDevice: NOW,
        file: {
          operationId: 'op-ev2',
          photoPath: 'ev-2.jpg',
          thumbnailPath: 'ev-2-t.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1000,
        },
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
    await expect(
      discardEvidence({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        evidenceId: 'ev-1',
        operationId: 'op-discard',
        discardedAtDevice: NOW,
      })
    ).rejects.toBeInstanceOf(InspectionStateError);

    const photos = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM evidences'
    );
    expect(photos?.total).toBe(1);
  });
});

describe('a server that already approved the inspection (RN-076)', () => {
  it('keeps the unsent work, locks the inspection and says why', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });

    await saveDownloadedInspection(OWNER, remoteInspection({ status: 'APPROVED' }), NOW);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('APPROVED');
    expect(stored?.detail.syncState).toBe('conflito');
    expect(stored?.detail.syncError).toContain('já foi aprovada no servidor');
    expect(stored?.responses).toHaveLength(1);
    expect(await countOpenOperations(OWNER)).toBe(2);
  });
});

describe('a device shared by two technicians (RN-004)', () => {
  it('never overwrites the unsent work of the technician who started the inspection', async () => {
    await started();

    await saveDownloadedInspection('tech-2', remoteInspection({ title: 'Reatribuída' }), NOW);

    expect((await findInspection(OWNER, 'insp-1'))?.detail.status).toBe('IN_PROGRESS');
    expect(await findInspection('tech-2', 'insp-1')).toBeNull();
  });

  it('hands a clean inspection over to the technician it was reassigned to', async () => {
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

    await saveDownloadedInspection('tech-2', remoteInspection({ title: 'Reatribuída' }), NOW);

    expect((await findInspection('tech-2', 'insp-1'))?.detail.title).toBe('Reatribuída');
    expect(await findInspection(OWNER, 'insp-1')).toBeNull();
  });
});

describe('refused completion', () => {
  it('reopens the inspection for correction and drops the refused submit', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });
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
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toEqual([
      'op-start',
      'op-r',
    ]);
  });
});

describe('correction after a rejection (card #30)', () => {
  const REJECTED_AT = '2026-08-12T15:00:00.000Z';
  const REOPENED_AT = '2026-08-12T16:00:00.000Z';
  const CORRECTED_AT = '2026-08-12T17:00:00.000Z';

  async function rejected(itemsToCorrect: string[]) {
    const base = remoteInspection();
    const second = { ...base.items[0]!, id: 'item-2', itemOrder: 2, itemTitle: 'Extintor' };
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        status: 'REJECTED',
        items: [...base.items, second],
        review: { decision: 'REJECTED', reason: 'Horímetro divergente.', itemsToCorrect },
      }),
      REJECTED_AT
    );
  }

  function reopen(operationId = 'op-reopen') {
    return reopenInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId,
      reopenedAtDevice: REOPENED_AT,
    });
  }

  it('keeps the rejected inspection read-only until the technician reopens it', async () => {
    await rejected(['item-1']);

    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-r',
        response: checklistAnswer(),
      })
    ).rejects.toBeInstanceOf(InspectionStateError);
  });

  it('reopens on the device, offline, and queues the transition', async () => {
    await rejected(['item-1']);

    await reopen();

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    expect(stored?.detail.syncState).toBe('aguardando-envio');
    expect(stored?.detail.review?.itemsToCorrect).toEqual(['item-1']);
    const [operation] = await listOpenOperations(OWNER);
    expect(operation).toMatchObject({
      operationId: 'op-reopen',
      operationType: 'TRANSITION',
      baseVersion: 3,
      payload: { action: 'REOPEN', reopenedAtDevice: REOPENED_AT },
    });
  });

  it('refuses to reopen an inspection that was not rejected, leaving nothing queued', async () => {
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

    await expect(reopen()).rejects.toBeInstanceOf(InspectionStateError);
    expect(await countOpenOperations(OWNER)).toBe(0);
  });

  it('accepts new answers only for the items the supervisor pointed out', async () => {
    await rejected(['item-1']);
    await reopen();

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-fix',
      response: checklistAnswer({ inspectionItemId: 'item-1', answeredAtDevice: CORRECTED_AT }),
    });
    await expect(
      saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-other',
        response: checklistAnswer({ id: 'resp-2', inspectionItemId: 'item-2' }),
      })
    ).rejects.toBeInstanceOf(ItemNotCorrectableError);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses.map((response) => response.inspectionItemId)).toEqual(['item-1']);
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toEqual([
      'op-reopen',
      'op-fix',
    ]);
  });

  it('reopens the whole inspection when no item was pointed out', async () => {
    await rejected([]);
    await reopen();

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-any',
      response: checklistAnswer({ inspectionItemId: 'item-2' }),
    });

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses.map((response) => response.inspectionItemId)).toEqual(['item-2']);
  });

  it('keeps the earlier rejection consultable after a second one (RN-083)', async () => {
    await rejected(['item-1']);
    await reopen();

    const afterFirst = await findInspection(OWNER, 'insp-1');
    expect(afterFirst?.detail.reviewHistory).toEqual([
      {
        decision: 'REJECTED',
        reason: 'Horímetro divergente.',
        itemsToCorrect: ['item-1'],
        reopenedAt: REOPENED_AT,
      },
    ]);

    await database.runAsync("UPDATE inspections SET is_dirty = 0, status = 'SUBMITTED'");
    const base = remoteInspection();
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        status: 'REJECTED',
        version: 5,
        updatedAt: 'v5',
        items: [...base.items, { ...base.items[0]!, id: 'item-2', itemOrder: 2 }],
        review: { decision: 'REJECTED', reason: 'Ainda divergente.', itemsToCorrect: [] },
      }),
      REOPENED_AT
    );

    const second = await findInspection(OWNER, 'insp-1');
    expect(second?.detail.review?.reason).toBe('Ainda divergente.');
    expect(second?.detail.reviewHistory.map((past) => past.reason)).toEqual([
      'Horímetro divergente.',
    ]);
  });

  it('submits the corrected inspection through the same completion checks', async () => {
    await rejected(['item-1']);
    await reopen();
    await expect(
      completeInspection({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-submit',
        completedAtDevice: NOW,
        location: DENIED,
      })
    ).rejects.toBeInstanceOf(InspectionIncompleteError);
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
      response: checklistAnswer(),
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
      remoteInspection({ status: 'IN_PROGRESS', startedAtDevice: NOW, startLocation: null }),
      NOW
    );

    expect((await findInspection(OWNER, 'insp-1'))?.detail.startLocation).toEqual(AT_GATE);
  });

  it('takes the position the server reports as a whole', async () => {
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
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
    await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

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
    expect(await readSchemaVersion(database)).toBe(MIGRATIONS.length);
  });

  it('creates every local structure of document 10.13', async () => {
    const tables = await database.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'inspections',
        'inspection_items',
        'inspection_responses',
        'evidences',
        'non_conformities',
        'sync_operations',
        'sync_metadata',
      ])
    );
  });

  it.each(['inspections', 'inspection_responses', 'evidences', 'non_conformities'])(
    'keeps the local sync metadata of document 10.13.2 on %s',
    async (table) => {
      const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);

      expect(columns.map((column) => column.name)).toEqual(
        expect.arrayContaining([
          'local_sync_status',
          'is_dirty',
          'last_synced_at',
          'base_version',
          'local_updated_at',
          'sync_error',
        ])
      );
    }
  );

  it.each(['inspection_responses', 'evidences', 'non_conformities'])(
    'marks a removal not yet confirmed on %s',
    async (table) => {
      const columns = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);

      expect(columns.map((column) => column.name)).toContain('deleted_locally');
    }
  );

  it('upgrades a device with unsent work without losing any of it', async () => {
    const old = await openTestDatabase({ schemaVersion: 2 });
    jest.mocked(getDatabase).mockResolvedValue(old);
    await started();
    await old.runAsync(
      `INSERT INTO inspection_responses (
         id, inspection_id, inspection_item_id, conformity, answered_at_device, base_version,
         local_sync_status, is_dirty, local_updated_at
       ) VALUES ('resp-1', 'insp-1', 'item-1', 'CONFORMING', ?, 3, 'PENDING', 1, ?)`,
      NOW,
      NOW
    );
    await old.runAsync(
      `INSERT INTO sync_operations (
         operation_id, owner_user_id, entity_type, entity_id, inspection_id, operation_type,
         base_version, payload_json, created_at, updated_at
       ) VALUES ('op-r', ?, 'RESPONSE', 'resp-1', 'insp-1', 'CREATE', 3, '{}', ?, ?)`,
      OWNER,
      '2026-08-12T13:00:01.000Z',
      '2026-08-12T13:00:01.000Z'
    );
    await old.runAsync(
      `INSERT INTO evidences (id, inspection_id, inspection_item_id, local_uri, created_at_device)
       VALUES ('ev-1', 'insp-1', 'item-1', 'file:///evidences/ev-1.jpg', ?)`,
      NOW
    );

    await migrate(old);

    expect(await readSchemaVersion(old)).toBe(MIGRATIONS.length);
    expect((await listOpenOperations(OWNER)).map((op) => op.operationId)).toEqual([
      'op-start',
      'op-r',
    ]);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.status).toBe('IN_PROGRESS');
    expect(stored?.detail.syncState).toBe('aguardando-envio');
    expect(stored?.responses).toEqual([expect.objectContaining({ conformity: 'CONFORMING' })]);
    expect(stored?.evidenceCounts.get('item-1')).toBe(1);
    expect(
      await old.getFirstAsync(
        "SELECT local_uri, response_id, is_dirty, deleted_locally FROM evidences WHERE id = 'ev-1'"
      )
    ).toEqual({
      local_uri: 'file:///evidences/ev-1.jpg',
      response_id: 'resp-1',
      is_dirty: 0,
      deleted_locally: 0,
    });
  });
});

describe('local queries (card #21)', () => {
  async function seed(total: number) {
    for (let index = 0; index < total; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0');
      await saveDownloadedInspection(
        OWNER,
        remoteInspection({
          id: `insp-${index}`,
          scheduledFor: `2026-08-${day}T13:00:00Z`,
          items: [{ ...remoteInspection().items[0]!, id: `item-${index}` }],
        }),
        NOW
      );
    }
  }

  it('reads the list through an index, without sorting it in memory', async () => {
    const plan = await database.getAllAsync<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT * FROM inspections WHERE owner_user_id = ? ORDER BY scheduled_for, id',
      OWNER
    );
    const steps = plan.map((step) => step.detail).join('\n');

    expect(steps).toContain('ix_inspections_owner_schedule');
    expect(steps).not.toContain('TEMP B-TREE');
  });

  it('finds an equipment by its QR code through an index', async () => {
    const plan = await database.getAllAsync<{ detail: string }>(
      'EXPLAIN QUERY PLAN SELECT id FROM inspections WHERE owner_user_id = ? AND equipment_qr_code = ?',
      OWNER,
      'QR-1'
    );

    expect(plan.map((step) => step.detail).join('\n')).toContain('ix_inspections_owner_qr');
  });

  it('lists 200 stored inspections quickly', async () => {
    await seed(200);

    const startedAt = performance.now();
    const summaries = await listInspectionSummaries(OWNER);
    const elapsed = performance.now() - startedAt;

    expect(summaries).toHaveLength(200);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('outbox (card #23)', () => {
  it('keeps the operation id through every retry', async () => {
    await started();

    await claimOperation('op-start', NOW);
    await releaseOperation('op-start', NOW);
    const retried = await claimOperation('op-start', NOW);
    await markFailed(retried!, 'FAILED', 'Tempo esgotado.', NOW);
    const again = await claimOperation('op-start', NOW);

    expect(again).toMatchObject({ operationId: 'op-start', attemptCount: 3 });
    expect(await countOpenOperations(OWNER)).toBe(1);
  });

  it('leaves the other operations untouched when one fails', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });
    const before = (await listOpenOperations(OWNER)).find((op) => op.operationId === 'op-r');
    const start = await claimOperation('op-start', NOW);

    await markFailed(start!, 'FAILED', 'Valor inválido.', NOW);

    const after = await listOpenOperations(OWNER);
    expect(after.find((op) => op.operationId === 'op-r')).toEqual(before);
    expect(after.map((op) => op.status)).toEqual(['FAILED', 'PENDING']);
  });

  it('survives closing the app and opening it again', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fieldops-outbox-'));
    const path = join(directory, 'fieldops.db');
    try {
      const first = await openTestDatabase({ path });
      jest.mocked(getDatabase).mockResolvedValue(first);
      await started();
      await claimOperation('op-start', NOW);
      first.closeNow();

      const reopened = await openTestDatabase({ path });
      jest.mocked(getDatabase).mockResolvedValue(reopened);
      await releaseInterruptedOperations(OWNER, NOW);

      expect(await listOpenOperations(OWNER)).toEqual([
        expect.objectContaining({ operationId: 'op-start', status: 'PENDING', attemptCount: 1 }),
      ]);
      reopened.closeNow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('never stores a credential in the error', async () => {
    await started();
    const start = await claimOperation('op-start', NOW);

    await markFailed(
      start!,
      'FAILED',
      'Recusado: Authorization Bearer eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJl token=abc123',
      NOW
    );

    const [failed] = await listOpenOperations(OWNER);
    expect(failed?.lastError).not.toMatch(/eyJ|abc123/);
    expect(failed?.lastError).toContain('Recusado');
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('falha');
  });

  it('counts exactly what is still owed', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });
    const start = await claimOperation('op-start', NOW);
    const response = await claimOperation('op-r', NOW);

    await markCompleted(start!, NOW);
    await markFailed(response!, 'CONFLICT', 'Versão desatualizada.', NOW);

    expect(await countOpenOperations(OWNER)).toBe(1);
  });
});

describe('evidence operations (card #23)', () => {
  const PHOTO = {
    photoPath: 'evidences/insp-1/ev-1.jpg',
    thumbnailPath: 'evidences/insp-1/ev-1-thumb.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 182_000,
  };

  async function withPhoto(operationId = 'op-upload') {
    await registerEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      evidenceId: 'ev-1',
      createdAtDevice: NOW,
      file: { ...PHOTO, operationId },
    });
  }

  function upload() {
    return listOpenOperations(OWNER).then((ops) => ops.find((op) => op.entityType === 'EVIDENCE'));
  }

  it('makes the upload wait for the answer it proves', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer({ conformity: 'NON_CONFORMING' }),
    });

    await withPhoto();

    const queued = await upload();
    expect(queued).toMatchObject({
      operationId: 'op-upload',
      operationType: 'UPLOAD',
      dependencyIds: ['op-r'],
      payload: { id: 'ev-1', responseId: 'resp-1', mimeType: 'image/jpeg' },
    });
    expect(JSON.stringify(queued?.payload)).not.toContain('file://');
  });

  it('makes a photo taken before the answer wait for the answer created later', async () => {
    await started();
    await withPhoto();
    expect((await upload())?.dependencyIds).toEqual([]);

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer({ conformity: 'NON_CONFORMING' }),
    });

    expect(await upload()).toMatchObject({
      dependencyIds: ['op-r'],
      payload: { responseId: 'resp-1' },
    });
    expect(
      await database.getFirstAsync("SELECT response_id FROM evidences WHERE id = 'ev-1'")
    ).toEqual({ response_id: 'resp-1' });
  });

  function discard() {
    return discardEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      evidenceId: 'ev-1',
      operationId: 'op-remove',
      discardedAtDevice: NOW,
    });
  }

  it('cancels the pending upload when the evidence is removed before it is sent', async () => {
    await started();
    await withPhoto();

    const outcome = await discard();

    expect(outcome).toEqual({ outcome: 'removed', files: [PHOTO.photoPath, PHOTO.thumbnailPath] });
    expect(await upload()).toBeUndefined();
    expect((await findInspection(OWNER, 'insp-1'))?.evidenceCounts.size).toBe(0);
  });

  it('shows the inspection as sent when the cancelled upload was all it owed', async () => {
    await started();
    const start = await claimOperation('op-start', NOW);
    await markCompleted(start!, NOW);
    await withPhoto();

    await discard();

    expect(await countOpenOperations(OWNER)).toBe(0);
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('enviado');
  });

  it('cancels an upload the server refused, which it never stored', async () => {
    await started();
    await withPhoto();
    const claimed = await claimOperation('op-upload', NOW);
    await markFailed(claimed!, 'FAILED', 'Formato não aceito.', NOW);

    expect(await discard()).toEqual({
      outcome: 'removed',
      files: [PHOTO.photoPath, PHOTO.thumbnailPath],
    });
  });

  it('queues the removal after an upload the network cut off, which the server may hold', async () => {
    await started();
    await withPhoto();
    await claimOperation('op-upload', NOW);
    await releaseOperation('op-upload', NOW);

    expect(await discard()).toEqual({ outcome: 'removal-queued' });
  });

  it('queues the removal after an upload already taken for sending', async () => {
    await started();
    await withPhoto();
    await claimOperation('op-upload', NOW);

    const outcome = await discard();

    expect(outcome).toEqual({ outcome: 'removal-queued' });
    const removal = (await listOpenOperations(OWNER)).find((op) => op.operationId === 'op-remove');
    expect(removal).toMatchObject({
      operationType: 'DELETE_LOGICAL',
      dependencyIds: ['op-upload'],
    });
    expect((await findInspection(OWNER, 'insp-1'))?.evidenceCounts.size).toBe(0);
  });

  it('marks the evidence as sent once its upload is confirmed', async () => {
    await started();
    await withPhoto();
    const claimed = await claimOperation('op-upload', NOW);

    await markCompleted(claimed!, NOW);

    expect(
      await database.getFirstAsync(
        "SELECT is_dirty, local_sync_status FROM evidences WHERE id = 'ev-1'"
      )
    ).toEqual({ is_dirty: 0, local_sync_status: 'SYNCED' });
  });
});

describe('sanitizeSyncError', () => {
  it('caps a long message', () => {
    expect(sanitizeSyncError('x'.repeat(1000))).toHaveLength(300);
  });

  it('keeps ordinary wording as it is', () => {
    expect(sanitizeSyncError('Item obrigatório sem resposta.')).toBe(
      'Item obrigatório sem resposta.'
    );
  });
});

describe('review findings', () => {
  const REOPENED_AT = '2026-08-12T16:00:00.000Z';

  async function reopenedWithOneItemToCorrect() {
    const base = remoteInspection();
    const second = { ...base.items[0]!, id: 'item-2', itemOrder: 2, itemTitle: 'Extintor' };
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        status: 'REJECTED',
        items: [...base.items, second],
        review: { decision: 'REJECTED', reason: 'Refazer.', itemsToCorrect: ['item-1'] },
      }),
      NOW
    );
    await reopenInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-reopen',
      reopenedAtDevice: REOPENED_AT,
    });
  }

  function photoFor(itemId: string) {
    return {
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: itemId,
      evidenceId: `ev-${itemId}`,
      createdAtDevice: REOPENED_AT,
      file: {
        operationId: `op-ev-${itemId}`,
        photoPath: `evidences/insp-1/${itemId}.jpg`,
        thumbnailPath: `evidences/insp-1/${itemId}-thumb.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      },
    };
  }

  describe('the correction scope reaches photos and non-conformities (RN-083)', () => {
    it('takes a photo only for an item the supervisor pointed out', async () => {
      await reopenedWithOneItemToCorrect();

      await expect(registerEvidence(photoFor('item-2'))).rejects.toBeInstanceOf(
        ItemNotCorrectableError
      );
      await registerEvidence(photoFor('item-1'));

      expect((await findInspection(OWNER, 'insp-1'))?.evidenceCounts.get('item-1')).toBe(1);
    });

    it('removes a photo only from an item the supervisor pointed out', async () => {
      await reopenedWithOneItemToCorrect();
      await database.runAsync(
        `INSERT INTO evidences (id, inspection_id, inspection_item_id, created_at_device)
         VALUES ('ev-old', 'insp-1', 'item-2', ?)`,
        NOW
      );

      await expect(
        discardEvidence({
          ownerUserId: OWNER,
          inspectionId: 'insp-1',
          evidenceId: 'ev-old',
          operationId: 'op-discard',
          discardedAtDevice: REOPENED_AT,
        })
      ).rejects.toBeInstanceOf(ItemNotCorrectableError);
    });

    it('registers a non-conformity only on an item the supervisor pointed out', async () => {
      await reopenedWithOneItemToCorrect();

      await expect(
        createNonConformity({
          ownerUserId: OWNER,
          inspectionId: 'insp-1',
          inspectionItemId: 'item-2',
          nonConformityId: 'nc-1',
          operationId: 'op-nc',
          createdAtDevice: REOPENED_AT,
          title: 'Trinca',
          description: 'Trinca na base.',
          severity: 'HIGH',
        })
      ).rejects.toBeInstanceOf(ItemNotCorrectableError);
    });

    it('removes a non-conformity only from an item the supervisor pointed out', async () => {
      await reopenedWithOneItemToCorrect();
      await database.runAsync(
        `INSERT INTO non_conformities (
           id, inspection_id, inspection_item_id, title, description, severity, created_at_device
         ) VALUES ('nc-old', 'insp-1', 'item-2', 'Trinca', 'Trinca na base.', 'HIGH', ?)`,
        NOW
      );

      await expect(
        deleteNonConformity({
          ownerUserId: OWNER,
          inspectionId: 'insp-1',
          nonConformityId: 'nc-old',
          deletedAtDevice: REOPENED_AT,
        })
      ).rejects.toBeInstanceOf(ItemNotCorrectableError);
    });
  });

  it('clears the completion data when the inspection is reopened for correction', async () => {
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({
        status: 'REJECTED',
        completedAtDevice: NOW,
        completionLocation: { latitude: -23.5, longitude: -47.4, accuracy: 10, capturedAt: NOW },
        review: { decision: 'REJECTED', reason: 'Refazer.', itemsToCorrect: [] },
      }),
      NOW
    );

    await reopenInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-reopen',
      reopenedAtDevice: REOPENED_AT,
    });

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.completedAtDevice).toBeNull();
    expect(stored?.detail.completionLocation).toEqual({ status: 'not-recorded' });
  });

  it('keeps the conflict visible when the technician saves another answer', async () => {
    await started();
    const [start] = await listOpenOperations(OWNER);
    const claimed = await claimOperation(start!.operationId, NOW);
    await markFailed(claimed!, 'CONFLICT', 'Alterada no servidor.', NOW);

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });

    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('conflito');
  });

  it('records the version the server returned for an answer', async () => {
    await started();
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-r',
      response: checklistAnswer(),
    });

    await recordResponseVersion('resp-1', 4);

    const row = await database.getFirstAsync<{ base_version: number }>(
      'SELECT base_version FROM inspection_responses WHERE id = ?',
      'resp-1'
    );
    expect(row?.base_version).toBe(4);
  });

  describe('equipment divergence (RN-064)', () => {
    const divergence = {
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      scannedEquipmentId: 'eq-9',
      scannedEquipmentName: 'Gerador 02',
      recordedAt: REOPENED_AT,
    };

    it('keeps the equipment the technician read next to the inspection, without queueing a send', async () => {
      await saveDownloadedInspection(OWNER, remoteInspection(), NOW);

      await recordEquipmentDivergence(divergence);

      const stored = await findInspection(OWNER, 'insp-1');
      expect(stored?.detail.equipmentDivergence).toEqual({
        scannedEquipmentId: 'eq-9',
        scannedEquipmentName: 'Gerador 02',
        recordedAt: REOPENED_AT,
      });
      expect(await countOpenOperations(OWNER)).toBe(0);
      expect(stored?.detail.syncState).toBe('salvo-no-dispositivo');
    });

    it('survives the next download of the same inspection', async () => {
      await saveDownloadedInspection(OWNER, remoteInspection(), NOW);
      await recordEquipmentDivergence(divergence);

      await saveDownloadedInspection(OWNER, remoteInspection({ title: 'Outro título' }), NOW);

      const stored = await findInspection(OWNER, 'insp-1');
      expect(stored?.detail.title).toBe('Outro título');
      expect(stored?.detail.equipmentDivergence?.scannedEquipmentName).toBe('Gerador 02');
    });

    it('is not recorded for an inspection that is already closed', async () => {
      await saveDownloadedInspection(OWNER, remoteInspection({ status: 'APPROVED' }), NOW);

      await expect(recordEquipmentDivergence(divergence)).rejects.toBeInstanceOf(
        InspectionStateError
      );
    });
  });
});
