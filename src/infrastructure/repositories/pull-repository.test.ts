import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import { listConflicts } from '@/infrastructure/repositories/conflict-repository';
import {
  findInspection,
  recordResponseVersion,
  recordSyncRun,
  saveDownloadedInspection,
  saveResponse,
} from '@/infrastructure/repositories/inspection-repository';
import {
  claimOperation,
  listOpenOperations,
  markCompleted,
} from '@/infrastructure/repositories/outbox-repository';
import { applyPulledPage, readPullCursor } from '@/infrastructure/repositories/pull-repository';
import {
  checklistAnswer,
  FIXTURE_TIME,
  remoteInspection,
} from '@/infrastructure/repositories/testing/inspection-fixtures';
import type { PulledChange } from '@/schemas/sync-pull';

jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';
const NOW = FIXTURE_TIME;
const LATER = '2026-08-12T15:00:00.000Z';

let database: SQLiteDatabase;

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
  await saveDownloadedInspection(OWNER, remoteInspection({ status: 'IN_PROGRESS' }), NOW);
});

function change(overrides: Record<string, unknown> = {}, version = 2): PulledChange {
  return {
    entityType: 'INSPECTION_RESPONSE',
    entityId: 'resp-1',
    changeType: 'UPSERT',
    version,
    payload: {
      id: 'resp-1',
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      valueDate: null,
      conformity: 'NON_CONFORMING',
      observation: 'Trinca.',
      answeredAtDevice: NOW,
      version,
      ...overrides,
    },
  };
}

async function answerAlreadySentAtVersion(version: number) {
  await saveResponse({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    operationId: 'op-first',
    response: checklistAnswer(),
  });
  const [first] = await listOpenOperations(OWNER);
  const claimed = await claimOperation(first!.operationId, NOW);
  await markCompleted(claimed!, NOW);
  await recordResponseVersion('resp-1', version);
}

async function editLocally(operationId = 'op-edit') {
  await saveResponse({
    ownerUserId: OWNER,
    inspectionId: 'insp-1',
    operationId,
    response: checklistAnswer({ conformity: 'CONFORMING', observation: 'Revisada.' }),
  });
}

describe('applying a pulled page', () => {
  it('stores an answer the device does not have, at the version the server reports', async () => {
    const outcome = await applyPulledPage(OWNER, [change()], 'cursor-1', LATER);

    expect(outcome).toEqual({ applied: 1, conflicts: 0, unresolved: 0, cursorAdvanced: true });
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({ id: 'resp-1', conformity: 'NON_CONFORMING' });
    const row = await database.getFirstAsync<{ base_version: number; is_dirty: number }>(
      'SELECT base_version, is_dirty FROM inspection_responses WHERE id = ?',
      'resp-1'
    );
    expect(row).toEqual({ base_version: 2, is_dirty: 0 });
  });

  it('replaces an answer that has no pending local change', async () => {
    await answerAlreadySentAtVersion(1);

    const outcome = await applyPulledPage(OWNER, [change()], 'cursor-1', LATER);

    expect(outcome.applied).toBe(1);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({
      conformity: 'NON_CONFORMING',
      observation: 'Trinca.',
    });
  });

  it('ignores a replay older than the version the device already holds', async () => {
    await answerAlreadySentAtVersion(4);

    const outcome = await applyPulledPage(OWNER, [change({}, 2)], 'cursor-1', LATER);

    expect(outcome.applied).toBe(0);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]?.conformity).toBe('CONFORMING');
  });

  it('keeps an unsent edit and records the conflict with both sides when the server moved on', async () => {
    await answerAlreadySentAtVersion(1);
    await editLocally();

    const outcome = await applyPulledPage(OWNER, [change({}, 3)], 'cursor-1', LATER);

    expect(outcome).toEqual({ applied: 0, conflicts: 1, unresolved: 0, cursorAdvanced: true });
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({
      conformity: 'CONFORMING',
      observation: 'Revisada.',
    });
    expect(stored?.detail.syncState).toBe('conflito');

    const [record] = await listConflicts(OWNER, 'insp-1');
    expect(record).toMatchObject({
      itemTitle: 'Proteção lateral',
      local: { conformity: 'CONFORMING', observation: 'Revisada.' },
      server: { conformity: 'NON_CONFORMING', observation: 'Trinca.' },
    });
    expect(record?.message).toContain('alterada no servidor');
  });

  it('holds the conflicted operation back from the next send', async () => {
    await answerAlreadySentAtVersion(1);
    await editLocally();

    await applyPulledPage(OWNER, [change({}, 3)], 'cursor-1', LATER);

    const [held] = await listOpenOperations(OWNER);
    expect(held?.status).toBe('CONFLICT');
  });

  it('does not call it a conflict when the server copy is the one the device already knows', async () => {
    await answerAlreadySentAtVersion(2);
    await editLocally();

    const outcome = await applyPulledPage(OWNER, [change({}, 2)], 'cursor-1', LATER);

    expect(outcome.conflicts).toBe(0);
    expect(await listConflicts(OWNER, 'insp-1')).toEqual([]);
  });

  it('does not call it a conflict when the pending first save is the answer the server echoes back', async () => {
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-first',
      response: checklistAnswer(),
    });

    const outcome = await applyPulledPage(OWNER, [change({}, 0)], 'cursor-1', LATER);

    expect(outcome.conflicts).toBe(0);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]?.conformity).toBe('CONFORMING');
  });

  it('flags a different server answer for an item the device answered offline', async () => {
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-first',
      response: checklistAnswer(),
    });

    const outcome = await applyPulledPage(OWNER, [change({ id: 'resp-other' })], 'c', LATER);

    expect(outcome.conflicts).toBe(1);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({ id: 'resp-1', conformity: 'CONFORMING' });
  });

  it('ignores other entity types, removals and malformed answers', async () => {
    const outcome = await applyPulledPage(
      OWNER,
      [
        { ...change(), entityType: 'EQUIPMENT' },
        { ...change(), changeType: 'DELETE_LOGICAL' },
        { ...change(), payload: { id: 'resp-1' } },
      ],
      'cursor-1',
      LATER
    );

    expect(outcome).toEqual({ applied: 0, conflicts: 0, unresolved: 0, cursorAdvanced: true });
    expect((await findInspection(OWNER, 'insp-1'))?.responses).toHaveLength(0);
  });
});

describe('the pull cursor', () => {
  it('is stored with the page and read back unchanged', async () => {
    expect(await readPullCursor(OWNER)).toBeNull();

    await applyPulledPage(OWNER, [], 'eyJ0cyI6IjIwMjYifQ==', LATER);

    expect(await readPullCursor(OWNER)).toBe('eyJ0cyI6IjIwMjYifQ==');
  });

  it('does not advance when an answer cannot be stored yet', async () => {
    await applyPulledPage(OWNER, [], 'cursor-1', LATER);

    const outcome = await applyPulledPage(
      OWNER,
      [change({ inspectionId: 'not-downloaded', inspectionItemId: 'item-x' })],
      'cursor-2',
      LATER
    );

    expect(outcome).toMatchObject({ unresolved: 1, cursorAdvanced: false });
    expect(await readPullCursor(OWNER)).toBe('cursor-1');
  });

  it('leaves the stored cursor alone when the page brings none', async () => {
    await applyPulledPage(OWNER, [], 'cursor-1', LATER);

    await applyPulledPage(OWNER, [change()], null, LATER);

    expect(await readPullCursor(OWNER)).toBe('cursor-1');
  });

  it('does not reach another technician', async () => {
    await applyPulledPage(OWNER, [], 'cursor-1', LATER);

    expect(await readPullCursor('someone-else')).toBeNull();
    const outcome = await applyPulledPage('someone-else', [change()], 'x', LATER);
    expect(outcome.unresolved).toBe(1);
  });

  it('survives a synchronization run record', async () => {
    await applyPulledPage(OWNER, [], 'cursor-1', LATER);

    await recordSyncRun(OWNER, 'SUCCESS', NOW, LATER);

    expect(await readPullCursor(OWNER)).toBe('cursor-1');
  });
});
