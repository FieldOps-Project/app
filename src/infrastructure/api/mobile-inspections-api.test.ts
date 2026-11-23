import { ok } from '@/domain/result';
import { request } from '@/infrastructure/api/http-client';
import {
  httpMobileInspectionsGateway,
  type ResponsePayload,
} from '@/infrastructure/api/mobile-inspections-api';

jest.mock('@/infrastructure/api/http-client', () => ({ request: jest.fn() }));

const answer: ResponsePayload = {
  id: 'resp-1',
  inspectionItemId: 'item-1',
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  conformity: null,
  observation: null,
  answeredAtDevice: '2026-08-12T10:00:00Z',
  baseVersion: 0,
};

beforeEach(() => {
  jest.mocked(request).mockReset();
  jest.mocked(request).mockResolvedValue(ok(undefined));
});

describe('putResponse', () => {
  it('sends only the boolean for a BOOLEAN item, because the API takes one value field per type', async () => {
    await httpMobileInspectionsGateway.putResponse('insp-1', {
      ...answer,
      valueBoolean: false,
      conformity: 'NON_CONFORMING',
    });

    expect(jest.mocked(request).mock.calls[0]?.[0].data).toEqual({
      ...answer,
      valueBoolean: false,
      conformity: null,
    });
  });

  it('keeps conformity for a CONFORMITY item', async () => {
    await httpMobileInspectionsGateway.putResponse('insp-1', {
      ...answer,
      conformity: 'NOT_APPLICABLE',
    });

    expect(jest.mocked(request).mock.calls[0]?.[0].data).toMatchObject({
      conformity: 'NOT_APPLICABLE',
    });
  });
});

describe('uploadEvidence', () => {
  it('posts the metadata and the file as the two multipart parts the API reads', async () => {
    const append = jest.spyOn(FormData.prototype, 'append');

    await httpMobileInspectionsGateway.uploadEvidence('insp-1', {
      metadata: {
        id: 'ev-1',
        responseId: 'resp-1',
        nonConformityId: null,
        type: 'PHOTO',
        capturedAtDevice: '2026-08-12T10:00:00Z',
        description: null,
      },
      fileUri: 'file:///docs/p.jpg',
      mimeType: 'image/jpeg',
    });

    expect(jest.mocked(request).mock.calls[0]?.[0].path).toBe(
      '/api/v1/inspections/insp-1/evidence'
    );
    const parts = new Map(append.mock.calls.map(([name, value]) => [name, value]));
    expect(parts.get('file')).toEqual({
      uri: 'file:///docs/p.jpg',
      name: 'ev-1.jpg',
      type: 'image/jpeg',
    });
    const metadata = parts.get('metadata') as unknown as { string: string; type: string };
    expect(metadata.type).toBe('application/json');
    expect(JSON.parse(metadata.string)).toEqual({
      id: 'ev-1',
      responseId: 'resp-1',
      nonConformityId: null,
      type: 'PHOTO',
      capturedAtDevice: '2026-08-12T10:00:00Z',
      description: null,
    });
    append.mockRestore();
  });
});
