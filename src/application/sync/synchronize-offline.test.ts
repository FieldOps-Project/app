import type { SQLiteDatabase } from 'expo-sqlite';

import { synchronize } from '@/application/sync/synchronize';
import { httpClient } from '@/infrastructure/api/http-client';
import { httpMobileInspectionsGateway } from '@/infrastructure/api/mobile-inspections-api';
import { fakeAdapter, type Reply } from '@/infrastructure/api/testing/fake-api';
import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import {
  findInspection,
  readLastSync,
  saveDownloadedInspection,
  saveResponse,
  startInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  countOpenOperations,
  listOpenOperations,
} from '@/infrastructure/repositories/outbox-repository';
import {
  checklistAnswer,
  FIXTURE_TIME,
  remoteInspection,
} from '@/infrastructure/repositories/testing/inspection-fixtures';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'local' } }));
jest.mock('@/infrastructure/storage/token-storage', () => ({
  readTokens: jest.fn(async () => null),
}));
jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';
const START_URL = '/api/v1/inspections/insp-1/start';
const ANSWER_URL = '/api/v1/inspections/insp-1/responses/resp-1';
const LISTING = { status: 200, data: { content: [], last: true } } as const;

interface Call {
  readonly method: string | undefined;
  readonly url: string | undefined;
}

let database: SQLiteDatabase;
let calls: Call[];
let reply: (call: Call) => Reply;

function wasSent(method: string, urlEnd: string): number {
  return calls.filter((call) => call.method === method && call.url?.endsWith(urlEnd)).length;
}

async function count(table: string): Promise<number> {
  const row = await database.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM ${table}`
  );
  return row?.total ?? 0;
}

async function queueStartAndAnswer() {
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
    response: checklistAnswer(),
  });
}

function serverAnswers(config: Call): Reply {
  if (config.method === 'get') {
    return LISTING;
  }
  return { status: 204 };
}

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
  calls = [];
  reply = serverAnswers;
  httpClient.defaults.adapter = fakeAdapter((config) => {
    const call = { method: config.method, url: config.url };
    calls.push(call);
    return reply(call);
  });
});

afterEach(() => {
  (database as unknown as { closeNow(): void }).closeNow();
});

describe('without a connection', () => {
  it.each<[string, Reply]>([
    ['no network', 'network'],
    ['a timeout', 'timeout'],
  ])('keeps every record on the device after %s', async (_name, failure) => {
    await queueStartAndAnswer();
    reply = () => failure;

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(await countOpenOperations(OWNER)).toBe(2);
    const operations = await listOpenOperations(OWNER);
    expect(operations.map((operation) => operation.status)).toEqual(['PENDING', 'PENDING']);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.syncState).toBe('aguardando-envio');
    expect(stored?.responses).toHaveLength(1);
    expect(await readLastSync(OWNER)).toMatchObject({ result: 'FAILED', lastSuccessfulAt: null });
  });

  it('sends everything once the connection comes back, and nothing again afterwards', async () => {
    await queueStartAndAnswer();
    reply = () => 'network';
    await synchronize(OWNER, httpMobileInspectionsGateway);
    expect(wasSent('post', START_URL)).toBe(1);

    reply = serverAnswers;
    const result = await synchronize(OWNER, httpMobileInspectionsGateway);
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result.ok && result.value.sent).toBe(2);
    expect(await countOpenOperations(OWNER)).toBe(0);
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('enviado');
    expect(wasSent('post', START_URL)).toBe(2);
    expect(wasSent('put', ANSWER_URL)).toBe(1);
  });
});

describe('when the server refuses', () => {
  it('stops on 401 and keeps the queue for after the next sign-in', async () => {
    await queueStartAndAnswer();
    reply = () => ({ status: 401, data: { code: 'AUTH_INVALID_TOKEN', message: 'x' } });

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(calls).toHaveLength(1);
    expect(await countOpenOperations(OWNER)).toBe(2);
    expect((await listOpenOperations(OWNER))[0]?.status).toBe('PENDING');
  });

  it('holds a 409 as a conflict, keeps the local answer and does not resend it', async () => {
    await queueStartAndAnswer();
    reply = (call) =>
      call.method === 'post'
        ? { status: 409, data: { code: 'INSPECTION_VERSION_CONFLICT', message: 'x' } }
        : serverAnswers(call);

    const first = await synchronize(OWNER, httpMobileInspectionsGateway);
    const attempts = wasSent('post', START_URL);
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(first.ok && first.value.refused).toBe(1);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.syncState).toBe('conflito');
    expect(stored?.responses).toHaveLength(1);
    expect(await countOpenOperations(OWNER)).toBe(2);
    expect(wasSent('post', START_URL)).toBe(attempts);
  });

  it('records a server fault as a failure and retries the very same operation', async () => {
    await queueStartAndAnswer();
    reply = (call) => (call.method === 'post' ? { status: 500 } : serverAnswers(call));
    await synchronize(OWNER, httpMobileInspectionsGateway);

    const [failed] = await listOpenOperations(OWNER);
    expect(failed).toMatchObject({ operationId: 'op-start', status: 'FAILED', attemptCount: 1 });
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('falha');

    expect(await readLastSync(OWNER)).toMatchObject({ result: 'PARTIAL', lastSuccessfulAt: null });

    reply = serverAnswers;
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(await countOpenOperations(OWNER)).toBe(0);
    expect(await count('sync_operations')).toBe(2);
    const settled = await readLastSync(OWNER);
    expect(settled).toMatchObject({ result: 'SUCCESS' });
    expect(settled.lastSuccessfulAt).not.toBeNull();
  });
});

describe('repeated operations (RN-068)', () => {
  it('keeps one record however many times the same answer is saved', async () => {
    await queueStartAndAnswer();

    for (let repeat = 0; repeat < 5; repeat += 1) {
      await saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: 'op-answer',
        response: checklistAnswer(),
      });
    }

    expect(await count('inspection_responses')).toBe(1);
    expect(await count('sync_operations')).toBe(2);
  });

  it('sends an answer once, however many times the queue is run', async () => {
    await queueStartAndAnswer();

    for (let run = 0; run < 3; run += 1) {
      await synchronize(OWNER, httpMobileInspectionsGateway);
    }

    expect(wasSent('put', ANSWER_URL)).toBe(1);
    expect(wasSent('post', START_URL)).toBe(1);
    expect(await count('inspection_responses')).toBe(1);
    expect(await count('sync_operations')).toBe(2);
  });

  it('resends an operation cut off mid-flight as the same operation, adding no record', async () => {
    await queueStartAndAnswer();
    await database.runAsync(
      `UPDATE sync_operations SET status = 'PROCESSING', attempt_count = 1 WHERE operation_id = ?`,
      'op-answer'
    );
    const before = {
      operations: await count('sync_operations'),
      answers: await count('inspection_responses'),
    };

    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(wasSent('put', ANSWER_URL)).toBe(1);
    expect(await count('sync_operations')).toBe(before.operations);
    expect(await count('inspection_responses')).toBe(before.answers);
    expect(await countOpenOperations(OWNER)).toBe(0);
    const resent = await database.getFirstAsync<{ status: string; attempt_count: number }>(
      'SELECT status, attempt_count FROM sync_operations WHERE operation_id = ?',
      'op-answer'
    );
    expect(resent).toEqual({ status: 'COMPLETED', attempt_count: 2 });
  });

  it('keeps a refused answer as the same single operation across retries', async () => {
    await queueStartAndAnswer();
    reply = (call) => (call.method === 'put' ? { status: 500 } : serverAnswers(call));
    await synchronize(OWNER, httpMobileInspectionsGateway);
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(wasSent('put', ANSWER_URL)).toBe(2);
    const answers = (await listOpenOperations(OWNER)).filter(
      (operation) => operation.entityType === 'RESPONSE'
    );
    expect(answers).toHaveLength(1);
    expect(answers[0]?.operationId).toBe('op-answer');
  });
});
