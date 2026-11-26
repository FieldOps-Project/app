import { pullChanges } from '@/application/sync/pull-changes';
import { synchronize } from '@/application/sync/synchronize';
import { fail, ok } from '@/domain/result';
import type { MobileInspectionsGateway } from '@/infrastructure/api';
import { deleteFile, evidenceUploadUri } from '@/infrastructure/evidence/photo-storage';
import {
  findEvidenceFile,
  findResponseBaseVersion,
  findServerUpdates,
  recordResponseVersion,
  recordSyncRun,
  saveDownloadedInspection,
} from '@/infrastructure/repositories/inspection-repository';
import {
  claimOperation,
  listOpenOperations,
  markCompleted,
  markFailed,
  releaseOperation,
  reopenAfterRefusedSubmit,
  type QueuedOperation,
} from '@/infrastructure/repositories/outbox-repository';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'local' } }));
jest.mock('@/infrastructure/repositories/inspection-repository');
jest.mock('@/infrastructure/repositories/outbox-repository');
jest.mock('@/infrastructure/evidence/photo-storage');
jest.mock('@/application/sync/pull-changes');

const now = () => '2026-08-12T13:00:00.000Z';

function answerPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resp-1',
    inspectionItemId: 'item-1',
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: 'CONFORMING',
    observation: null,
    answeredAtDevice: '2026-08-12T10:00:00-03:00',
    ...overrides,
  };
}

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
    pull: jest.fn(async () => ok({ changes: [], nextCursor: null, hasMore: false })),
    start: jest.fn(async () => ok(undefined)),
    submit: jest.fn(async () => ok(undefined)),
    reopen: jest.fn(async () => ok(undefined)),
    putResponse: jest.fn(async () => ok(0)),
    createNonConformity: jest.fn(async () => ok(undefined)),
    uploadEvidence: jest.fn(async () => ok(undefined)),
    deleteEvidence: jest.fn(async () => ok(undefined)),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(findServerUpdates).mockResolvedValue(new Map());
  jest.mocked(pullChanges).mockResolvedValue(ok({ applied: 0, conflicts: 0, held: false }));
  jest.mocked(findResponseBaseVersion).mockResolvedValue(0);
  jest.mocked(claimOperation).mockImplementation(async (operationId) => {
    const queued = await jest.mocked(listOpenOperations).getMockImplementation()?.('u-1');
    return queued?.find((op) => op.operationId === operationId) ?? null;
  });
});

function queue(operations: QueuedOperation[]) {
  jest.mocked(listOpenOperations).mockImplementation(async () => operations);
}

describe('synchronize', () => {
  it('sends each operation with the payload it was queued with, then downloads', async () => {
    const start = operation({ operationId: 'op-start' });
    const answer = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: answerPayload(),
    });
    queue([start, answer]);
    const api = gateway();

    const result = await synchronize('u-1', api, now);

    expect(api.start).toHaveBeenCalledWith('insp-1', {
      startedAtDevice: '2026-08-12T10:00:00-03:00',
      location: null,
    });
    expect(api.putResponse).toHaveBeenCalledWith('insp-1', {
      ...(answer.payload as object),
      baseVersion: 0,
    });
    expect(markCompleted).toHaveBeenCalledTimes(2);
    expect(api.list).toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      value: {
        sent: 2,
        refused: 0,
        refresh: { saved: 0, failed: 0 },
        pull: { applied: 0, conflicts: 0, held: false },
      },
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
      payload: answerPayload(),
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
    queue([refused, submit, other]);
    const api = gateway({
      putResponse: jest.fn(async () =>
        fail({
          kind: 'business' as const,
          code: 'VALIDATION_ERROR',
          message: 'value must be a number',
        })
      ),
    });

    const result = await synchronize('u-1', api, now);

    expect(markFailed).toHaveBeenCalledWith(
      refused,
      'FAILED',
      'Alguma informação enviada não é válida. Revise e tente novamente.',
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
    queue([start]);
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

describe('ordering', () => {
  it('waits while a dependency is still open, even one in conflict', async () => {
    const conflicted = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      status: 'CONFLICT',
      payload: answerPayload(),
    });
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
      dependencyIds: ['op-answer'],
    });
    queue([conflicted, submit]);
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(api.putResponse).not.toHaveBeenCalled();
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('uploads a photo with its metadata and the file, before the submit that waits for it', async () => {
    const upload = operation({
      operationId: 'op-upload',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'UPLOAD',
      payload: {
        id: 'ev-1',
        inspectionItemId: 'item-1',
        responseId: 'resp-1',
        nonConformityId: 'nc-1',
        description: 'Trinca',
        capturedAtDevice: '2026-08-12T10:00:00Z',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      },
    });
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
      dependencyIds: ['op-upload'],
    });
    queue([upload, submit]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: 't.jpg', mimeType: 'image/jpeg' });
    jest.mocked(evidenceUploadUri).mockReturnValue('file:///docs/evidences/p.jpg');
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(api.uploadEvidence).toHaveBeenCalledWith('insp-1', {
      metadata: {
        id: 'ev-1',
        responseId: 'resp-1',
        nonConformityId: 'nc-1',
        description: 'Trinca',
        capturedAtDevice: '2026-08-12T10:00:00Z',
        type: 'PHOTO',
      },
      fileUri: 'file:///docs/evidences/p.jpg',
      mimeType: 'image/jpeg',
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(markCompleted).toHaveBeenCalledTimes(2);
  });

  it('fails a photo whose file is gone without holding the rest of the queue', async () => {
    const upload = operation({
      operationId: 'op-upload',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      inspectionId: 'insp-2',
      operationType: 'UPLOAD',
      payload: {
        id: 'ev-1',
        inspectionItemId: 'item-1',
        responseId: null,
        description: null,
        capturedAtDevice: 'x',
      },
    });
    const other = operation({ operationId: 'op-other', inspectionId: 'insp-3' });
    queue([upload, other]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'gone.jpg', thumbnailPath: null, mimeType: 'image/jpeg' });
    jest.mocked(evidenceUploadUri).mockReturnValue(null);
    const api = gateway();

    const result = await synchronize('u-1', api, now);

    expect(api.uploadEvidence).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      upload,
      'FAILED',
      'O arquivo da foto não está mais neste aparelho.',
      expect.any(String)
    );
    expect(api.start).toHaveBeenCalledWith('insp-3', expect.anything());
    expect(result.ok && result.value.refused).toBe(1);
  });

  it('sends a photo that was taken before its item was answered, after that answer', async () => {
    const upload = operation({
      operationId: 'op-upload',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'UPLOAD',
      payload: {
        id: 'ev-1',
        inspectionItemId: 'item-1',
        responseId: 'resp-1',
        description: null,
        capturedAtDevice: 'x',
      },
      dependencyIds: ['op-answer'],
    });
    const answer = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: answerPayload(),
    });
    queue([upload, answer]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: null, mimeType: 'image/jpeg' });
    jest.mocked(evidenceUploadUri).mockReturnValue('file:///docs/p.jpg');
    const order: string[] = [];
    const api = gateway({
      putResponse: jest.fn(async () => {
        order.push('answer');
        return ok(0);
      }),
      uploadEvidence: jest.fn(async () => {
        order.push('upload');
        return ok(undefined);
      }),
    });

    await synchronize('u-1', api, now);

    expect(order).toEqual(['answer', 'upload']);
  });

  it('treats a removal the server no longer knows as done', async () => {
    const removal = operation({
      operationId: 'op-remove',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'DELETE_LOGICAL',
      payload: { id: 'ev-1' },
    });
    queue([removal]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: null, mimeType: 'image/jpeg' });
    const api = gateway({
      deleteEvidence: jest.fn(async () => fail({ kind: 'notFound' as const })),
    });

    await synchronize('u-1', api, now);

    expect(markCompleted).toHaveBeenCalledWith(removal, expect.any(String));
    expect(markFailed).not.toHaveBeenCalled();
    expect(deleteFile).toHaveBeenCalledWith('p.jpg');
  });

  it('reopens a completed inspection whose photo the server refuses, so the photo can be discarded', async () => {
    const upload = operation({
      operationId: 'op-upload',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'UPLOAD',
      payload: {
        id: 'ev-1',
        inspectionItemId: 'item-1',
        responseId: null,
        description: null,
        capturedAtDevice: 'x',
      },
    });
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
      dependencyIds: ['op-upload'],
    });
    queue([upload, submit]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: null, mimeType: 'image/jpeg' });
    jest.mocked(evidenceUploadUri).mockReturnValue('file:///docs/p.jpg');
    const api = gateway({
      uploadEvidence: jest.fn(async () =>
        fail({ kind: 'business' as const, code: 'EVIDENCE_TOO_LARGE', message: '' })
      ),
    });

    await synchronize('u-1', api, now);

    expect(markFailed).toHaveBeenCalledWith(
      upload,
      'FAILED',
      expect.any(String),
      expect.any(String)
    );
    expect(reopenAfterRefusedSubmit).toHaveBeenCalledWith(
      submit,
      'A foto é maior do que o servidor aceita. Fotografe de novo.',
      expect.any(String)
    );
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('creates a non-conformity with the id made on the device', async () => {
    const created = operation({
      operationId: 'op-nc',
      entityType: 'NON_CONFORMITY',
      entityId: 'nc-1',
      operationType: 'CREATE',
      payload: {
        id: 'nc-1',
        inspectionItemId: 'item-1',
        responseId: 'resp-1',
        title: 'Vazamento',
        description: 'Óleo na base.',
        severity: 'CRITICAL',
        status: 'OPEN',
        createdAtDevice: '2026-08-12T10:00:00Z',
      },
    });
    queue([created]);
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(api.createNonConformity).toHaveBeenCalledWith('insp-1', {
      id: 'nc-1',
      inspectionItemId: 'item-1',
      responseId: 'resp-1',
      title: 'Vazamento',
      description: 'Óleo na base.',
      severity: 'CRITICAL',
      createdAtDevice: '2026-08-12T10:00:00Z',
    });
    expect(markCompleted).toHaveBeenCalledWith(created, expect.any(String));
  });

  it('asks the server to remove a sent photo and then frees its files on the device', async () => {
    const removal = operation({
      operationId: 'op-remove',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'DELETE_LOGICAL',
      payload: { id: 'ev-1' },
    });
    queue([removal]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: 't.jpg', mimeType: 'image/jpeg' });
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(api.deleteEvidence).toHaveBeenCalledWith('ev-1');
    expect(deleteFile).toHaveBeenCalledWith('p.jpg');
    expect(deleteFile).toHaveBeenCalledWith('t.jpg');
  });

  it('keeps the files of a photo the server did not remove', async () => {
    const removal = operation({
      operationId: 'op-remove',
      entityType: 'EVIDENCE',
      entityId: 'ev-1',
      operationType: 'DELETE_LOGICAL',
      payload: { id: 'ev-1' },
    });
    queue([removal]);
    jest
      .mocked(findEvidenceFile)
      .mockResolvedValue({ photoPath: 'p.jpg', thumbnailPath: 't.jpg', mimeType: 'image/jpeg' });
    const api = gateway({ deleteEvidence: jest.fn(async () => fail({ kind: 'server' as const })) });

    await synchronize('u-1', api, now);

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('reopens the inspection when the server refuses the completion', async () => {
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
    });
    queue([submit]);
    const api = gateway({
      submit: jest.fn(async () =>
        fail({
          kind: 'business' as const,
          code: 'INSPECTION_REQUIRED_ITEMS_MISSING',
          message: 'required items are missing',
        })
      ),
    });

    await synchronize('u-1', api, now);

    expect(reopenAfterRefusedSubmit).toHaveBeenCalledWith(
      submit,
      'Há itens obrigatórios sem resposta. Volte ao checklist e complete as pendências.',
      expect.any(String)
    );
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('sends the claimed copy of the operation', async () => {
    const listed = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: answerPayload(),
    });
    queue([listed]);
    jest
      .mocked(claimOperation)
      .mockResolvedValue({ ...listed, payload: answerPayload({ conformity: 'NON_CONFORMING' }) });
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(api.putResponse).toHaveBeenCalledWith(
      'insp-1',
      answerPayload({ conformity: 'NON_CONFORMING', baseVersion: 0 })
    );
  });

  it('sends the version the server last returned for the answer, and stores the new one', async () => {
    const edit = operation({
      operationId: 'op-edit',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'UPDATE',
      payload: answerPayload({ baseVersion: 7 }),
    });
    queue([edit]);
    jest.mocked(findResponseBaseVersion).mockResolvedValue(2);
    const api = gateway({ putResponse: jest.fn(async () => ok(3)) });

    await synchronize('u-1', api, now);

    expect(api.putResponse).toHaveBeenCalledWith('insp-1', answerPayload({ baseVersion: 2 }));
    expect(recordResponseVersion).toHaveBeenCalledWith('resp-1', 3);
  });

  it('shares one run between concurrent calls', async () => {
    queue([operation({})]);
    const api = gateway();

    await Promise.all([synchronize('u-1', api, now), synchronize('u-1', api, now)]);

    expect(api.start).toHaveBeenCalledTimes(1);
  });
});

describe('reopening after a rejection', () => {
  it('reopens on the server before the corrected answers and the new submit', async () => {
    const calls: string[] = [];
    queue([
      operation({
        operationId: 'op-reopen',
        entityType: 'INSPECTION',
        entityId: 'insp-1',
        operationType: 'TRANSITION',
        payload: { action: 'REOPEN', reopenedAtDevice: '2026-08-12T10:00:00Z' },
      }),
      operation({
        operationId: 'op-resp',
        entityType: 'RESPONSE',
        entityId: 'resp-1',
        payload: answerPayload(),
      }),
    ]);
    const api = gateway({
      reopen: jest.fn(async () => {
        calls.push('reopen');
        return ok(undefined);
      }),
      putResponse: jest.fn(async () => {
        calls.push('put');
        return ok(1);
      }),
    });

    await synchronize('u-1', api, now);

    expect(calls).toEqual(['reopen', 'put']);
    expect(api.reopen).toHaveBeenCalledWith('insp-1');
  });

  it('holds the corrected answers back when the server refuses the reopening', async () => {
    queue([
      operation({
        operationId: 'op-reopen',
        entityType: 'INSPECTION',
        entityId: 'insp-1',
        operationType: 'TRANSITION',
        payload: { action: 'REOPEN', reopenedAtDevice: '2026-08-12T10:00:00Z' },
      }),
      operation({
        operationId: 'op-resp',
        entityType: 'RESPONSE',
        entityId: 'resp-1',
        payload: answerPayload(),
      }),
    ]);
    const api = gateway({
      reopen: jest.fn(async () =>
        fail({ kind: 'conflict' as const, code: 'INSPECTION_VERSION_CONFLICT' })
      ),
    });

    await synchronize('u-1', api, now);

    expect(api.putResponse).not.toHaveBeenCalled();
  });
});

describe('refresh as part of synchronize', () => {
  it('keeps what is stored when one detail fails and saves the others', async () => {
    queue([]);
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
    queue([]);
    jest.mocked(findServerUpdates).mockResolvedValue(new Map([['a', 'v1']]));
    const api = gateway({ list: jest.fn(async () => ok([{ id: 'a', updatedAt: 'v1' }])) });

    await synchronize('u-1', api, now);

    expect(api.detail).not.toHaveBeenCalled();
  });
});

describe('pulling server changes after sending', () => {
  it('pulls after the download and reports success when nothing diverged', async () => {
    queue([]);
    const api = gateway();

    await synchronize('u-1', api, now);

    expect(pullChanges).toHaveBeenCalledWith('u-1', api, now);
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'SUCCESS',
      expect.any(String),
      expect.any(String)
    );
  });

  it('marks the run partial when the pull found a conflict', async () => {
    queue([]);
    jest.mocked(pullChanges).mockResolvedValue(ok({ applied: 0, conflicts: 1, held: false }));

    const result = await synchronize('u-1', gateway(), now);

    expect(result.ok && result.value.pull?.conflicts).toBe(1);
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'PARTIAL',
      expect.any(String),
      expect.any(String)
    );
  });

  it('marks the run partial when the pull held the cursor', async () => {
    queue([]);
    jest.mocked(pullChanges).mockResolvedValue(ok({ applied: 0, conflicts: 0, held: true }));

    await synchronize('u-1', gateway(), now);

    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'PARTIAL',
      expect.any(String),
      expect.any(String)
    );
  });

  it('keeps what was sent and reports partial when the pull fails on the server', async () => {
    queue([]);
    jest.mocked(pullChanges).mockResolvedValue(fail({ kind: 'server' }));

    const result = await synchronize('u-1', gateway(), now);

    expect(result.ok && result.value.pull).toBeNull();
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'PARTIAL',
      expect.any(String),
      expect.any(String)
    );
  });

  it('fails the run when the connection drops during the pull', async () => {
    queue([]);
    jest.mocked(pullChanges).mockResolvedValue(fail({ kind: 'network' }));

    const result = await synchronize('u-1', gateway(), now);

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'FAILED',
      expect.any(String),
      expect.any(String)
    );
  });
});

describe('a refusal that means the server already applied the step', () => {
  const refusal = {
    kind: 'business' as const,
    code: 'INSPECTION_INVALID_TRANSITION',
    message: 'invalid transition',
  };

  function serverShows(status: string) {
    return jest.fn(async () => ok({ status } as never));
  }

  it('completes a submit the server already holds instead of reopening the inspection', async () => {
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
    });
    queue([submit]);
    const api = gateway({
      submit: jest.fn(async () => fail(refusal)),
      detail: serverShows('SUBMITTED'),
    });

    const result = await synchronize('u-1', api, now);

    expect(markCompleted).toHaveBeenCalledWith(submit, expect.any(String));
    expect(reopenAfterRefusedSubmit).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(result.ok && result.value.sent).toBe(1);
  });

  it('still reopens a submit the server did not apply', async () => {
    const submit = operation({
      operationId: 'op-submit',
      payload: { action: 'SUBMIT', completedAtDevice: 'x', location: null },
    });
    queue([submit]);
    const api = gateway({
      submit: jest.fn(async () => fail(refusal)),
      detail: serverShows('IN_PROGRESS'),
    });

    await synchronize('u-1', api, now);

    expect(reopenAfterRefusedSubmit).toHaveBeenCalled();
    expect(markCompleted).not.toHaveBeenCalled();
  });

  it('completes a start the server already holds', async () => {
    const start = operation({});
    queue([start]);
    const api = gateway({
      start: jest.fn(async () => fail(refusal)),
      detail: serverShows('IN_PROGRESS'),
    });

    await synchronize('u-1', api, now);

    expect(markCompleted).toHaveBeenCalledWith(start, expect.any(String));
    expect(markFailed).not.toHaveBeenCalled();
  });

  it('completes a reopening the server already holds', async () => {
    const reopen = operation({
      operationId: 'op-reopen',
      payload: { action: 'REOPEN', reopenedAtDevice: 'x' },
    });
    queue([reopen]);
    const api = gateway({
      reopen: jest.fn(async () => fail(refusal)),
      detail: serverShows('IN_PROGRESS'),
    });

    await synchronize('u-1', api, now);

    expect(markCompleted).toHaveBeenCalledWith(reopen, expect.any(String));
  });

  it('does not treat a refused answer as applied just because the inspection moved on', async () => {
    const answer = operation({
      operationId: 'op-answer',
      entityType: 'RESPONSE',
      entityId: 'resp-1',
      operationType: 'CREATE',
      payload: answerPayload(),
    });
    queue([answer]);
    const api = gateway({
      putResponse: jest.fn(async () => fail(refusal)),
      detail: serverShows('SUBMITTED'),
    });

    await synchronize('u-1', api, now);

    expect(markFailed).toHaveBeenCalled();
    expect(markCompleted).not.toHaveBeenCalled();
  });
});

describe('an outage on the server', () => {
  it('stops the run after two server failures instead of retrying the whole queue', async () => {
    queue([
      operation({ operationId: 'op-1', inspectionId: 'a' }),
      operation({ operationId: 'op-2', inspectionId: 'b' }),
      operation({ operationId: 'op-3', inspectionId: 'c' }),
    ]);
    const api = gateway({ start: jest.fn(async () => fail({ kind: 'server' as const })) });

    const result = await synchronize('u-1', api, now);

    expect(api.start).toHaveBeenCalledTimes(2);
    expect(markFailed).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, error: { kind: 'server' } });
    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'FAILED',
      expect.any(String),
      expect.any(String)
    );
  });

  it('keeps going after a single server failure', async () => {
    queue([
      operation({ operationId: 'op-1', inspectionId: 'a' }),
      operation({ operationId: 'op-2', inspectionId: 'b' }),
    ]);
    const start = jest
      .fn()
      .mockResolvedValueOnce(fail({ kind: 'server' as const }))
      .mockResolvedValueOnce(ok(undefined));

    const result = await synchronize('u-1', gateway({ start }), now);

    expect(start).toHaveBeenCalledTimes(2);
    expect(result.ok && result.value.refused).toBe(1);
  });
});

describe('conflicts that were already open', () => {
  it('keeps the run partial while an inspection stays held by a conflict', async () => {
    queue([operation({ status: 'CONFLICT' })]);

    await synchronize('u-1', gateway(), now);

    expect(recordSyncRun).toHaveBeenLastCalledWith(
      'u-1',
      'PARTIAL',
      expect.any(String),
      expect.any(String)
    );
  });
});
