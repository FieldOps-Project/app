import {
  EQUIPMENT_CODE_MAX,
  identifyEquipment,
  normalizeEquipmentCode,
  type EquipmentMatch,
} from '@/domain/equipment-identification';
import type { InspectionEquipment } from '@/domain/inspection';

const COMPRESSOR: InspectionEquipment = {
  id: 'eq-1',
  name: 'Compressor 01',
  qrCode: 'EQP-001',
  assetNumber: 'PAT-1',
  serialNumber: null,
};

const GENERATOR: InspectionEquipment = { ...COMPRESSOR, id: 'eq-2', name: 'Gerador 02' };

function match(equipment: InspectionEquipment): EquipmentMatch {
  return { equipment, inspections: [] };
}

describe('normalizeEquipmentCode', () => {
  it('trims the code and refuses an empty or oversized one', () => {
    expect(normalizeEquipmentCode('  EQP-001 \n')).toBe('EQP-001');
    expect(normalizeEquipmentCode('   ')).toBeNull();
    expect(normalizeEquipmentCode('x'.repeat(EQUIPMENT_CODE_MAX + 1))).toBeNull();
  });
});

describe('identifyEquipment', () => {
  it('confirms the equipment the inspection expects', () => {
    expect(identifyEquipment(COMPRESSOR, match(COMPRESSOR))).toEqual({
      kind: 'confirmed',
      equipment: COMPRESSOR,
    });
  });

  it('flags a different equipment instead of going on silently (RN-064)', () => {
    expect(identifyEquipment(COMPRESSOR, match(GENERATOR))).toEqual({
      kind: 'divergent',
      expected: COMPRESSOR,
      read: match(GENERATOR),
    });
  });

  it('shows what was read when nothing is expected', () => {
    expect(identifyEquipment(null, match(GENERATOR))).toEqual({
      kind: 'found',
      match: match(GENERATOR),
    });
  });

  it('reports an unknown code, saying when the server could not be asked', () => {
    expect(identifyEquipment(COMPRESSOR, null, 'offline')).toEqual({
      kind: 'not-found',
      server: 'offline',
    });
    expect(identifyEquipment(COMPRESSOR, null)).toEqual({ kind: 'not-found', server: 'answered' });
  });
});
