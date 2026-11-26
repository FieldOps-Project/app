import type { SQLiteDatabase } from 'expo-sqlite';

import { synchronize } from '@/application/sync/synchronize';
import { httpClient } from '@/infrastructure/api/http-client';
import { httpMobileInspectionsGateway } from '@/infrastructure/api/mobile-inspections-api';
import { fakeAdapter, type Reply } from '@/infrastructure/api/testing/fake-api';
import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import { createNonConformity } from '@/infrastructure/repositories/non-conformity-repository';
import {
  completeInspection,
  discardEvidence,
  findInspection,
  registerEvidence,
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
jest.mock('@/infrastructure/evidence/photo-storage', () => ({
  evidenceUploadUri: jest.fn((path: string) => `file:///documents/evidences/${path}`),
  deleteFile: jest.fn(),
}));
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
  readonly data?: unknown;
  readonly params?: Record<string, unknown>;
}

function recordFormData() {
  const parts: [string, unknown][] = [];
  const original = globalThis.FormData;
  class FormData {
    append(name: string, value: unknown) {
      parts.push([name, value]);
    }
  }
  globalThis.FormData = FormData as unknown as typeof globalThis.FormData;
  return {
    parts,
    restore: () => {
      globalThis.FormData = original;
    },
  };
}

let database: SQLiteDatabase;
let calls: Call[];
let reply: (call: Call) => Reply;
let pulled: (call: Call) => Reply;

const EMPTY_PULL: Reply = {
  status: 200,
  data: { changes: [], nextCursor: null, hasMore: false },
};

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
  if (config.url?.endsWith('/mobile/sync/pull') === true) {
    return pulled(config);
  }
  if (config.method === 'get') {
    return LISTING;
  }
  if (config.method === 'put') {
    return { status: 200, data: { version: 0 } };
  }
  return { status: 204 };
}

beforeEach(async () => {
  database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
  calls = [];
  reply = serverAnswers;
  pulled = () => EMPTY_PULL;
  httpClient.defaults.adapter = fakeAdapter((config) => {
    const call = {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params as Record<string, unknown> | undefined,
    };
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

  it('edits an answer with the version the server returned for it, not the inspection version', async () => {
    await queueStartAndAnswer();
    let version = 0;
    reply = (call) =>
      call.method === 'put' ? { status: 200, data: { version: version++ } } : serverAnswers(call);

    await synchronize(OWNER, httpMobileInspectionsGateway);
    for (const note of ['segunda', 'terceira']) {
      await saveResponse({
        ownerUserId: OWNER,
        inspectionId: 'insp-1',
        operationId: `op-${note}`,
        response: checklistAnswer({ observation: note }),
      });
      await synchronize(OWNER, httpMobileInspectionsGateway);
    }

    const sent = calls
      .filter((call) => call.method === 'put' && call.url?.endsWith(ANSWER_URL))
      .map((call) => (JSON.parse(call.data as string) as { baseVersion: number }).baseVersion);
    expect(sent).toEqual([0, 0, 1]);
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

describe('an inspection with a photo and a non-conformity', () => {
  async function readyToSend() {
    await queueStartAndAnswer();
    await createNonConformity({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      nonConformityId: 'nc-1',
      operationId: 'op-nc',
      createdAtDevice: FIXTURE_TIME,
      title: 'Vazamento hidráulico',
      description: 'Óleo escorrendo pela base.',
      severity: 'CRITICAL',
    });
    await registerEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      nonConformityId: 'nc-1',
      evidenceId: 'ev-1',
      createdAtDevice: FIXTURE_TIME,
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
      completedAtDevice: FIXTURE_TIME,
      location: { status: 'missing', reason: 'PERMISSION_DENIED' },
    });
  }

  function order(): string[] {
    return calls
      .filter((call) => call.method !== 'get')
      .map((call) => `${call.method} ${call.url}`);
  }

  it('sends everything in dependency order, and the completion comes last', async () => {
    await readyToSend();

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(order()).toEqual([
      `post ${START_URL}`,
      `put ${ANSWER_URL}`,
      'post /api/v1/inspections/insp-1/non-conformities',
      'post /api/v1/inspections/insp-1/evidence',
      'post /api/v1/inspections/insp-1/submit',
    ]);
    expect(result.ok && result.value.sent).toBe(5);
    expect(await countOpenOperations(OWNER)).toBe(0);
    expect((await findInspection(OWNER, 'insp-1'))?.detail.syncState).toBe('enviado');
  });

  it('sends nothing twice when the queue runs again', async () => {
    await readyToSend();
    await synchronize(OWNER, httpMobileInspectionsGateway);

    await synchronize(OWNER, httpMobileInspectionsGateway);
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(order()).toHaveLength(5);
  });

  it('holds the completion while the photo is refused, and sends the rest', async () => {
    await readyToSend();
    reply = (call) =>
      call.url?.endsWith('/evidence') === true
        ? { status: 415, data: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'x' } }
        : serverAnswers(call);

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(order().some((entry) => entry.endsWith('/submit'))).toBe(false);
    expect(order()).toContain('post /api/v1/inspections/insp-1/non-conformities');
    expect(result.ok && result.value.refused).toBe(1);
    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.detail.syncState).toBe('falha');
    expect(stored?.detail.syncError).toBe('O servidor não aceita este formato de imagem.');
  });

  it('keeps the photo and its place in the queue when the connection drops during the upload', async () => {
    await readyToSend();
    reply = (call) => (call.url?.endsWith('/evidence') === true ? 'timeout' : serverAnswers(call));

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);
    reply = serverAnswers;
    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(await countOpenOperations(OWNER)).toBe(0);
    expect(order().filter((entry) => entry.endsWith('/evidence'))).toHaveLength(2);
    expect(order().filter((entry) => entry.endsWith('/non-conformities'))).toHaveLength(1);
  });

  it('puts the photo and its metadata in the multipart body the way React Native sends them', async () => {
    await readyToSend();
    const sent = recordFormData();

    await synchronize(OWNER, httpMobileInspectionsGateway);

    sent.restore();
    const appended = new Map(sent.parts as [string, Record<string, unknown>][]);
    expect(appended.get('file')).toEqual({
      uri: 'file:///documents/evidences/ev-1.jpg',
      name: 'ev-1.jpg',
      type: 'image/jpeg',
    });
    expect(appended.get('metadata')).toMatchObject({ type: 'application/json' });
    expect(JSON.parse(String(appended.get('metadata')?.string))).toMatchObject({
      id: 'ev-1',
      nonConformityId: 'nc-1',
      type: 'PHOTO',
    });
  });

  it('can discard a photo the server refused, once the completion was reopened', async () => {
    await readyToSend();
    reply = (call) =>
      call.url?.endsWith('/evidence') === true
        ? { status: 413, data: { code: 'PAYLOAD_TOO_LARGE', message: 'x' } }
        : serverAnswers(call);

    await synchronize(OWNER, httpMobileInspectionsGateway);

    const reopened = await findInspection(OWNER, 'insp-1');
    expect(reopened?.detail.status).toBe('IN_PROGRESS');
    expect(reopened?.detail.syncError).toBe(
      'A foto é maior do que o servidor aceita. Fotografe de novo.'
    );
    const removed = await discardEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      evidenceId: 'ev-1',
      operationId: 'op-discard',
      discardedAtDevice: FIXTURE_TIME,
    });
    expect(removed.outcome).toBe('removed');
    expect((await listOpenOperations(OWNER)).map((op) => op.entityType)).not.toContain('EVIDENCE');
  });
});

describe('a photo taken before its item was answered', () => {
  it('is sent after the answer instead of blocking the inspection', async () => {
    await saveDownloadedInspection(OWNER, remoteInspection(), FIXTURE_TIME);
    await startInspection({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-start',
      startedAtDevice: FIXTURE_TIME,
      location: { status: 'missing', reason: 'PERMISSION_DENIED' },
    });
    await registerEvidence({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      inspectionItemId: 'item-1',
      evidenceId: 'ev-early',
      createdAtDevice: FIXTURE_TIME,
      file: {
        operationId: 'op-early',
        photoPath: 'ev-early.jpg',
        thumbnailPath: 'ev-early-t.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      },
    });
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-answer',
      response: checklistAnswer(),
    });

    await synchronize(OWNER, httpMobileInspectionsGateway);

    const sentInOrder = calls
      .filter((call) => call.method !== 'get')
      .map((call) => `${call.method} ${call.url}`);
    expect(sentInOrder).toEqual([
      `post ${START_URL}`,
      `put ${ANSWER_URL}`,
      'post /api/v1/inspections/insp-1/evidence',
    ]);
    expect(await countOpenOperations(OWNER)).toBe(0);
  });
});

function pulledAnswer(overrides: Record<string, unknown> = {}) {
  return {
    entityType: 'INSPECTION_RESPONSE',
    entityId: 'resp-1',
    changeType: 'UPSERT',
    version: 2,
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
      answeredAtDevice: FIXTURE_TIME,
      version: 2,
      ...overrides,
    },
  };
}

function page(changes: unknown[], nextCursor: string | null, hasMore = false): Reply {
  return { status: 200, data: { changes, nextCursor, hasMore } };
}

async function storedCursor(): Promise<string | null> {
  const row = await database.getFirstAsync<{ pull_cursor: string | null }>(
    'SELECT pull_cursor FROM sync_metadata WHERE owner_user_id = ?',
    OWNER
  );
  return row?.pull_cursor ?? null;
}

describe('pulling the answers already saved on the server', () => {
  it('recovers an answer the device does not have and edits it from the server version', async () => {
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({ status: 'IN_PROGRESS' }),
      FIXTURE_TIME
    );
    pulled = () => page([pulledAnswer()], 'cursor-1');

    await synchronize(OWNER, httpMobileInspectionsGateway);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({
      id: 'resp-1',
      conformity: 'NON_CONFORMING',
      observation: 'Trinca.',
    });
    expect(await storedCursor()).toBe('cursor-1');

    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-edit',
      response: checklistAnswer({ conformity: 'CONFORMING', observation: null }),
    });
    pulled = () => EMPTY_PULL;
    await synchronize(OWNER, httpMobileInspectionsGateway);

    const put = calls.find((call) => call.method === 'put');
    expect(JSON.parse(put?.data as string)).toMatchObject({ id: 'resp-1', baseVersion: 2 });
  });

  it('asks for the next page with the cursor it stored and keeps paging until the end', async () => {
    await saveDownloadedInspection(
      OWNER,
      remoteInspection({ status: 'IN_PROGRESS' }),
      FIXTURE_TIME
    );
    pulled = (call) =>
      call.params?.cursor === 'cursor-1'
        ? page([], 'cursor-2')
        : page([pulledAnswer()], 'cursor-1', true);

    await synchronize(OWNER, httpMobileInspectionsGateway);

    const asked = calls
      .filter((call) => call.url?.endsWith('/mobile/sync/pull'))
      .map((call) => call.params?.cursor);
    expect(asked).toEqual([undefined, 'cursor-1']);
    expect(await storedCursor()).toBe('cursor-2');
  });

  it('keeps the cursor when an answer belongs to an inspection not stored yet', async () => {
    pulled = () => page([pulledAnswer()], 'cursor-1');

    await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(await storedCursor()).toBeNull();
    expect(await readLastSync(OWNER)).toMatchObject({ result: 'PARTIAL' });
    expect(await count('inspection_responses')).toBe(0);
  });

  it('keeps the cursor when the pull page itself fails', async () => {
    pulled = () => ({ status: 500 });

    const result = await synchronize(OWNER, httpMobileInspectionsGateway);

    expect(result.ok).toBe(true);
    expect(await storedCursor()).toBeNull();
    expect(await readLastSync(OWNER)).toMatchObject({ result: 'PARTIAL' });
  });

  it('preserves the local value and keeps both sides when the server changed it meanwhile', async () => {
    await queueStartAndAnswer();
    await synchronize(OWNER, httpMobileInspectionsGateway);
    await saveResponse({
      ownerUserId: OWNER,
      inspectionId: 'insp-1',
      operationId: 'op-edit',
      response: checklistAnswer({ conformity: 'CONFORMING', observation: 'Revisada.' }),
    });
    reply = (call) => (call.method === 'put' ? { status: 409 } : serverAnswers(call));
    pulled = () => page([pulledAnswer({ version: 5 })], 'cursor-9');

    await synchronize(OWNER, httpMobileInspectionsGateway);

    const stored = await findInspection(OWNER, 'insp-1');
    expect(stored?.responses[0]).toMatchObject({
      conformity: 'CONFORMING',
      observation: 'Revisada.',
    });
    expect(stored?.detail.syncState).toBe('conflito');
    const [held] = await listOpenOperations(OWNER);
    expect(held).toMatchObject({ status: 'CONFLICT' });
    const kept = await database.getFirstAsync<{ server_state_json: string }>(
      'SELECT server_state_json FROM sync_operations WHERE operation_id = ?',
      held?.operationId ?? ''
    );
    expect(JSON.parse(kept?.server_state_json ?? '{}')).toMatchObject({
      conformity: 'NON_CONFORMING',
      observation: 'Trinca.',
      version: 5,
    });
    expect(await readLastSync(OWNER)).toMatchObject({ result: 'PARTIAL' });
  });
});
