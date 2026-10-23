import { mobileInspectionListSchema, mobileInspectionSchema } from '@/schemas/mobile-inspection';

const DETAIL = {
  id: 'insp-1',
  title: 'Inspeção do gerador',
  status: 'ASSIGNED',
  priority: 'HIGH',
  scheduledFor: '2026-08-12T13:00:00Z',
  instructions: 'Desligar antes de abrir.',
  version: 3,
  client: { id: 'c-1', name: 'Indústria ABC' },
  site: {
    id: 's-1',
    name: 'Fábrica Sorocaba',
    addressLine: null,
    latitude: -23.5,
    longitude: -47.4,
  },
  equipment: {
    id: 'e-1',
    name: 'Gerador GD-001',
    qrCode: 'QR',
    assetNumber: null,
    serialNumber: null,
  },
  items: [
    {
      id: 'item-1',
      sectionTitle: 'Geral',
      sectionOrder: 1,
      itemTitle: 'Proteção lateral',
      responseType: 'CONFORMITY',
      required: true,
      rules: { observationRequiredOnFailure: true, evidenceRequiredOnFailure: true },
      options: [],
      itemOrder: 3,
    },
  ],
  responses: [],
  review: { decision: 'REJECTED', reason: 'Foto desfocada.', itemsToCorrect: ['item-1'] },
};

describe('mobileInspectionSchema', () => {
  it('reads the aggregate of the contract (backend#19)', () => {
    const parsed = mobileInspectionSchema.parse(DETAIL);

    expect(parsed.version).toBe(3);
    expect(parsed.items[0]?.rules).toEqual({
      observationRequiredOnFailure: true,
      evidenceRequiredOnFailure: true,
      min: null,
      max: null,
    });
    expect(parsed.review?.itemsToCorrect).toEqual(['item-1']);
  });

  it('fills absent optional fields with null instead of rejecting the payload', () => {
    const { equipment: _equipment, review: _review, responses: _responses, ...minimal } = DETAIL;
    const parsed = mobileInspectionSchema.parse({ ...minimal, instructions: undefined });

    expect(parsed.equipment).toBeNull();
    expect(parsed.review).toBeNull();
    expect(parsed.responses).toEqual([]);
    expect(parsed.instructions).toBeNull();
    expect(parsed.items[0]?.itemDescription).toBeNull();
  });

  it('keeps a response type this version does not know, so one item cannot hide the checklist', () => {
    const parsed = mobileInspectionSchema.parse({
      ...DETAIL,
      items: [{ ...DETAIL.items[0], responseType: 'THERMAL_IMAGE' }],
    });

    expect(parsed.items[0]?.responseType).toBe('THERMAL_IMAGE');
  });

  it('rejects a payload without the business status', () => {
    expect(mobileInspectionSchema.safeParse({ ...DETAIL, status: 'UNKNOWN' }).success).toBe(false);
  });
});

describe('mobileInspectionListSchema', () => {
  it('accepts a bare array', () => {
    expect(mobileInspectionListSchema.parse([{ id: 'a' }])).toEqual({
      content: [{ id: 'a', updatedAt: null }],
      last: true,
    });
  });

  it('accepts a Spring page', () => {
    expect(
      mobileInspectionListSchema.parse({ content: [{ id: 'a', updatedAt: 'x' }], last: false })
    ).toEqual({ content: [{ id: 'a', updatedAt: 'x' }], last: false });
  });
});
