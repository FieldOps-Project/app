import type { SQLiteDatabase } from 'expo-sqlite';

import { synchronize } from '@/application/sync/synchronize';
import { httpClient } from '@/infrastructure/api/http-client';
import { httpMobileInspectionsGateway } from '@/infrastructure/api/mobile-inspections-api';
import { fakeAdapter, type Reply } from '@/infrastructure/api/testing/fake-api';
import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import {
  findInspection,
  readLastSuccessfulSync,
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

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));
jest.mock('@/infrastructure/storage/token-storage', () => ({
  readTokens: jest.fn(async () => null),
}));
jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';
const LISTING = { status: 200, data: { content: [], last: true } } as const;

interface Call {
  readonly method: string | undefined;
  readonly url: string | undefined;
}

let database: SQLiteDatabase;
let calls: Call[];
let deliveries: string[];
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

async function startedWithAnAnswer() {
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
  deliveries = [];
  reply = serverAnswers;
  httpClient.defaults.adapter = fakeAdapter((config) => {
    const call = { method: config.method, url: config.url };
    calls.push(call);
    if (call.method !== 'get') {
      deliveries.push(`${call.method} ${call.url}`);
    }
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
    await startedWithAnAnswer();
    reply = () => failure;

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(await countOpenOperations(OWNER)).toBe(2);
    const operations = await listOpenOperations(OWNER);
    expect(operations.map((operation) => operation.status)).toEqual(['PENDING', 'PENDING']);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.syncState).toBe('aguardando-envio');
    expect(stored?.responses).toHaveLength(1);
    expect(await readLastSuccessfulSync(OWNER)).toBeNull();
  });

  it('sends everything once the connection comes back, and nothing twice', async () => {
    await startedWithAnAnswer();
    reply = () => 'network';
    await synchronize(OWNER, httpMobileInspectionsGateway);

    reply = serverAnswers;
    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result.ok && result.value.sent).toBe(2);
    expect(await countOpenOperations(OWNER)).toBe(0);
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('enviado');
    expect(wasSent('post', '/api/v1/inspections/insp-1/start')).toBe(2);
  });
});

describe('when the server refuses', () => {
  it('stops on 401 and keeps the queue for after the next sign-in', async () => {
    await startedWithAnAnswer();
    reply = () => ({ status: 401, data: { code: 'AUTH_INVALID_TOKEN', message: 'x' } });

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(await countOpenOperations(OWNER)).toBe(2);
    expect((await listOpenOperations(OWNER))[0]?.status).toBe('PENDING');
  });

  it('holds a 409 as a conflict, keeps the local answer and does not resend it', async () => {
    await startedWithAnAnswer();
    reply = (call) =>
      call.method === 'post'
        ? { status: 409, data: { code: 'INSPECTION_VERSION_CONFLICT', message: 'x' } }
        : serverAnswers(call);

    const first = await synchronize(OWNER, httpMobileInspectionsGateway);
    const attempts = wasSent('post', '/api/v1/inspections/insp-1/start');
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(first.ok && first.value.refused).toBe(1);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.syncState).toBe('conflito');
    expect(stored?.responses).toHaveLength(1);
    expect(await countOpenOperations(OWNER)).toBe(2);
    expect(wasSent('post', '/api/v1/inspections/insp-1/start')).toBe(attempts);
  });

  it('records a server fault as a failure and retries the very same operation', async () => {
    await startedWithAnAnswer();
    reply = (call) => (call.method === 'post' ? { status: 500 } : serverAnswers(call));
    await synchronize(OWNER, httpMobileInspectionsGateway);

    const [failed] = await listOpenOperations(OWNER);
    expect(failed).toMatchObject({ operationId: 'op-start', status: 'FAILED', attemptCount: 1 });
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('falha');

    reply = serverAnswers;
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(await countOpenOperations(OWNER)).toBe(0);
    expect(await count('sync_operations')).toBe(2);
  });
});

describe('repeated operations (RN-068)', () => {
  it('keeps one record however many times the same answer is saved', async () => {
    await startedWithAnAnswer();

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
    await startedWithAnAnswer();

    for (let run = 0; run < 3; run += 1) {
      await synchronize(OWNER, httpMobileInspectionsGateway);
    }

    expect(wasSent('put', '/api/v1/inspections/insp-1/responses/resp-1')).toBe(1);
    expect(wasSent('post', '/api/v1/inspections/insp-1/start')).toBe(1);
    expect(await count('inspection_responses')).toBe(1);
    expect(await count('sync_operations')).toBe(2);
  });

  it('resends an operation cut off mid-flight under the same identity, adding no record', async () => {
    await startedWithAnAnswer();
    await database.runAsync(
      `UPDATE sync_operations SET status = 'PROCESSING', attempt_count = 1 WHERE operation_id = ?`,
      'op-answer'
    );
    const before = {
      operations: await count('sync_operations'),
      answers: await count('inspection_responses'),
    };

    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(wasSent('put', '/api/v1/inspections/insp-1/responses/resp-1')).toBe(1);
    expect(await count('sync_operations')).toBe(before.operations);
    expect(await count('inspection_responses')).toBe(before.answers);
    expect(new Set(deliveries).size).toBe(deliveries.length);
    expect(await countOpenOperations(OWNER)).toBe(0);
  });

  it('shows a refused answer to be sent again under its original id', async () => {
    await startedWithAnAnswer();
    reply = (call) => (call.method === 'put' ? { status: 500 } : serverAnswers(call));
    await synchronize(OWNER, httpMobileInspectionsGateway);
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(wasSent('put', '/api/v1/inspections/insp-1/responses/resp-1')).toBe(2);
    const answers = (await listOpenOperations(OWNER)).filter(
      (operation) => operation.entityType === 'RESPONSE'
    );
    expect(answers).toHaveLength(1);
    expect(answers[0]?.operationId).toBe('op-answer');
  });
});
