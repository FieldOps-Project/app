import { synchronize } from '@/application/sync/synchronize';
import { fail, ok } from '@/domain/result';
import type { MobileInspectionsGateway } from '@/infrastructure/api';
import {
  findServerUpdates,
  recordSyncRun,
  saveDownloadedInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  listOpenOperations,
  markCompleted,
  markFailed,
  releaseOperation,
  type QueuedOperation,
} from '@/infrastructure/repositories/outbox-repository';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));
jest.mock('@/infrastructure/repositories/inspection-repository');
jest.mock('@/infrastructure/repositories/outbox-repository');

const now = () => '2026-08-12T13:00:00.000Z';

function operation(overrides: Partial<QueuedOperation>): QueuedOperation {
  return {
    operationId: 'op-1',
    entityType: 'INSPECTION',
    entityId: 'insp-1',
    inspectionId: 'insp-1',
    operationType: 'TRANSITION',
    baseVersion: 1,
    payload: { action: 'START', startedAtDevice: '2026-08-12T10:00:00-03:00', location: null },
    dependencyIds: [],
    status: 'PENDING',
    attemptCount: 0,
    lastError: null,
    ...overrides,
  };
}

function gateway(overrides: Partial<MobileInspectionsGateway> = {}): MobileInspectionsGateway {
  return {
    list: jest.fn(async () => ok([])),
    detail: jest.fn(async () => fail({ kind: 'notFound' as const })),
    start: jest.fn(async () => ok(undefined)),
    submit: jest.fn(async () => ok(undefined)),
    putResponse: jest.fn(async () => ok(undefined)),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findServerUpdates).mockResolvedValue(new Map());
});

describe('synchronize', () => {
  it('sends each operation with the payload it was queued with, then downloads', async () => {
    const start = operation({ operationId: 'op-start' });
    const answer = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: { id: 'resp-1', inspectionItemId: 'item-1', conformity: 'CONFORMING' },
    });
    jest.mocked(listOpenOperations).mockResolvedValue([start, answer]);
    const api = gateway();

    const result = await synchronize('u-1', api, now);

    expect(api.start).toHaveBeenCalledWith('insp-1', {
      startedAtDevice: '2026-08-12T10:00:00-03:00',
      location: null,
    });
    expect(api.putResponse).toHaveBeenCalledWith('insp-1', answer.payload);
    expect(markCompleted).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      value: { sent: 2, refused: 0, refresh: { saved: 0, failed: 0 } },
    });
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'SUCCESS',
      expect.any(String),
      expect.any(String)
    );
  });

  it('stops without touching the queue when the network drops', async () => {
    jest
      .mocked(listOpenOperations)
      .mockResolvedValue([operation({}), operation({ operationId: 'op-2' })]);
    const api = gateway({ start: jest.fn(async () => fail({ kind: 'network' as const })) });

    const result = await synchronize('u-1', api, now);

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(releaseOperation).toHaveBeenCalledWith('op-1', expect.any(String));
    expect(markFailed).not.toHaveBeenCalled();
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.list).not.toHaveBeenCalled();
  });

  it('holds back the rest of an inspection after a refusal, and carries on with the others', async () => {
    const refused = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: { id: 'resp-1' },
    });
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: '2026-08-12T11:00:00-03:00', location: null },
    });
    const other = operation({
      operationId: 'op-other',
      entityId: 'insp-2',
      inspectionId: 'insp-2',
    });
    jest.mocked(listOpenOperations).mockResolvedValue([refused, submit, other]);
    const api = gateway({
      putResponse: jest.fn(async () =>
        fail({ kind: 'business' as const, code: 'RESPONSE_INVALID', message: 'Valor inválido.' })
      ),
    });

    const result = await synchronize('u-1', api, now);

    expect(markFailed).toHaveBeenCalledWith(
      refused,
      'FAILED',
      'Valor inválido.',
      expect.any(String)
    );
    expect(api.submit).not.toHaveBeenCalled();
    expect(api.start).toHaveBeenCalledWith('insp-2', expect.anything());
    expect(result.ok && result.value.refused).toBe(1);
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'PARTIAL',
      expect.any(String),
      expect.any(String)
    );
  });

  it('records a refused transition as a conflict', async () => {
    const start = operation({});
    jest.mocked(listOpenOperations).mockResolvedValue([start]);
    const api = gateway({
      start: jest.fn(async () =>
        fail({ kind: 'conflict' as const, code: 'INSPECTION_INVALID_TRANSITION' })
      ),
    });

    await synchronize('u-1', api, now);

    expect(markFailed).toHaveBeenCalledWith(
      start,
      'CONFLICT',
      expect.any(String),
      expect.any(String)
    );
  });
});

describe('refresh as part of synchronize', () => {
  it('keeps what is stored when one detail fails and saves the others', async () => {
    jest.mocked(listOpenOperations).mockResolvedValue([]);
    const remote = { id: 'b' };
    const api = gateway({
      list: jest.fn(async () =>
        ok([
          { id: 'a', updatedAt: null },
          { id: 'b', updatedAt: null },
        ])
      ),
      detail: jest.fn(async (id: string) =>
        id === 'a' ? fail({ kind: 'server' as const }) : ok(remote as never)
      ),
    });

    const result = await synchronize('u-1', api, now);

    expect(saveDownloadedInspection).toHaveBeenCalledTimes(1);
    expect(saveDownloadedInspection).toHaveBeenCalledWith('u-1', remote, expect.any(String));
    expect(result.ok && result.value.refresh).toEqual({ saved: 1, failed: 1 });
  });

  it('skips an inspection whose server version is already stored', async () => {
    jest.mocked(listOpenOperations).mockResolvedValue([]);
    jest.mocked(findServerUpdates).mockResolvedValue(new Map([['a', 'v1']]));
    const api = gateway({ list: jest.fn(async () => ok([{ id: 'a', updatedAt: 'v1' }])) });

    await synchronize('u-1', api, now);

    expect(api.detail).not.toHaveBeenCalled();
  });
});
