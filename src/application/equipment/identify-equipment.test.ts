import { identifyByCode } from '@/application/equipment/identify-equipment';
import { EQUIPMENT_CODE_MAX } from '@/domain/equipment-identification';
import { fail, ok } from '@/domain/result';
import type { EquipmentGateway } from '@/infrastructure/api';
import { getDatabase } from '@/infrastructure/database/database';
import { openTestDatabase } from '@/infrastructure/database/testing/node-sqlite';
import { saveDownloadedInspection } from '@/infrastructure/repositories/inspection-repository';
import type { MobileInspection } from '@/schemas/mobile-inspection';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));
jest.mock('@/infrastructure/database/database', () => ({
  ...jest.requireActual('@/infrastructure/database/database'),
  getDatabase: jest.fn(),
}));

const OWNER = 'tech-1';
const NOW = '2026-08-12T13:00:00.000Z';

const COMPRESSOR = {
  id: 'eq-1',
  name: 'Compressor 01',
  qrCode: 'EQP-001',
  assetNumber: 'PAT-1',
  serialNumber: 'SN-1',
};

function inspection(overrides: Partial<MobileInspection>): MobileInspection {
  return {
    id: 'insp-1',
    title: 'Inspeção do compressor',
    status: 'ASSIGNED',
    priority: 'HIGH',
    scheduledFor: '2026-08-12T13:00:00Z',
    instructions: null,
    version: 1,
    updatedAt: 'v1',
    startedAtDevice: null,
    completedAtDevice: null,
    startLocation: null,
    completionLocation: null,
    client: { id: 'c-1', name: 'Indústria ABC' },
    site: { id: 's-1', name: 'Fábrica', addressLine: null, latitude: null, longitude: null },
    equipment: COMPRESSOR,
    items: [],
    responses: [],
    review: null,
    ...overrides,
  };
}

function camera(code: string) {
  return { code, source: 'camera' as const };
}

function gateway(result: Awaited<ReturnType<EquipmentGateway['findIdByQrCode']>>) {
  return { findIdByQrCode: jest.fn(async () => result) };
}

beforeEach(async () => {
  const database = await openTestDatabase();
  jest.mocked(getDatabase).mockResolvedValue(database);
  await saveDownloadedInspection(OWNER, inspection({}), NOW);
  await saveDownloadedInspection(
    'tech-2',
    inspection({
      id: 'insp-other',
      equipment: { ...COMPRESSOR, id: 'eq-9', name: 'Bomba 09', qrCode: 'EQP-009' },
    }),
    NOW
  );
});

describe('identifyByCode', () => {
  it('finds the equipment on the device first, without asking the server', async () => {
    const api = gateway(ok('eq-1'));

    const result = await identifyByCode(OWNER, camera('EQP-001'), null, api);

    expect(result).toEqual({
      kind: 'found',
      match: {
        equipment: COMPRESSOR,
        inspections: [
          {
            id: 'insp-1',
            title: 'Inspeção do compressor',
            status: 'ASSIGNED',
            scheduledFor: '2026-08-12T13:00:00Z',
          },
        ],
      },
    });
    expect(api.findIdByQrCode).not.toHaveBeenCalled();
  });

  it('accepts the asset number typed by hand', async () => {
    const result = await identifyByCode(
      OWNER,
      { code: 'PAT-1', source: 'manual' },
      null,
      gateway(ok(null))
    );

    expect(result).toMatchObject({ kind: 'found', match: { equipment: { id: 'eq-1' } } });
  });

  it('confirms the expected equipment and flags a different one', async () => {
    const generator = { ...COMPRESSOR, id: 'eq-2', name: 'Gerador 02', qrCode: 'EQP-002' };
    await saveDownloadedInspection(OWNER, inspection({ id: 'insp-2', equipment: generator }), NOW);

    expect(await identifyByCode(OWNER, camera('EQP-001'), COMPRESSOR, gateway(ok(null)))).toEqual({
      kind: 'confirmed',
      equipment: COMPRESSOR,
    });
    expect(
      await identifyByCode(OWNER, camera('EQP-002'), COMPRESSOR, gateway(ok(null)))
    ).toMatchObject({
      kind: 'divergent',
      expected: COMPRESSOR,
      scanned: { equipment: { id: 'eq-2' } },
    });
  });

  it('asks the server for a code the device does not know, and shows it only when in scope', async () => {
    const result = await identifyByCode(OWNER, camera('EQP-NEW-LABEL'), null, gateway(ok('eq-1')));

    expect(result).toMatchObject({ kind: 'found', match: { equipment: { id: 'eq-1' } } });
  });

  it('never shows an equipment outside the technician scope, even with a valid code (RN-063)', async () => {
    expect(await identifyByCode(OWNER, camera('EQP-009'), null, gateway(ok('eq-9')))).toEqual({
      kind: 'not-found',
      server: 'answered',
    });
  });

  it('says the server could not be asked when offline', async () => {
    expect(
      await identifyByCode(
        OWNER,
        camera('EQP-404'),
        null,
        gateway(fail({ kind: 'network' as const }))
      )
    ).toEqual({ kind: 'not-found', server: 'offline' });
  });

  it('reads only QR codes from the camera, never an asset number', async () => {
    expect(await identifyByCode(OWNER, camera('PAT-1'), null, gateway(ok(null)))).toEqual({
      kind: 'not-found',
      server: 'answered',
    });
  });

  it('tells a server failure apart from an unknown code', async () => {
    expect(
      await identifyByCode(
        OWNER,
        camera('EQP-404'),
        null,
        gateway(fail({ kind: 'server' as const }))
      )
    ).toEqual({ kind: 'not-found', server: 'failed' });
  });

  it('trims what the camera or the keyboard reports before looking it up', async () => {
    const result = await identifyByCode(OWNER, camera('  EQP-001\n'), null, gateway(ok(null)));

    expect(result).toMatchObject({ kind: 'found', match: { equipment: { id: 'eq-1' } } });
  });

  it('answers an unusable code as not found, without asking the server', async () => {
    const api = gateway(ok('eq-1'));

    expect(await identifyByCode(OWNER, camera('   '), null, api)).toEqual({
      kind: 'not-found',
      server: 'answered',
    });
    expect(
      await identifyByCode(OWNER, camera('x'.repeat(EQUIPMENT_CODE_MAX + 1)), null, api)
    ).toEqual({ kind: 'not-found', server: 'answered' });
    expect(api.findIdByQrCode).not.toHaveBeenCalled();
  });

  it('reports a code nobody knows', async () => {
    expect(await identifyByCode(OWNER, camera('EQP-404'), null, gateway(ok(null)))).toEqual({
      kind: 'not-found',
      server: 'answered',
    });
  });
});
