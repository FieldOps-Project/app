import type { InspectionDetail } from '@/domain/inspection';
import { describeRecordedLocation, inspectionMarkers } from '@/features/location/describe-location';

const POSITION = {
  latitude: -23.5012,
  longitude: -47.4531,
  accuracy: 18.4,
  capturedAt: '2026-08-12T13:00:00Z',
};

describe('describeRecordedLocation', () => {
  it('prints coordinates and accuracy of a captured position', () => {
    expect(describeRecordedLocation('start', { status: 'captured', position: POSITION })).toMatch(
      /^Início: -23\.50120, -47\.45310 \(precisão de 18 m\), lida em /
    );
  });

  it('states the reason for a missing position', () => {
    expect(describeRecordedLocation('completion', { status: 'missing', reason: 'TIMEOUT' })).toBe(
      'Conclusão sem localização: o aparelho não encontrou a posição a tempo.'
    );
  });
});

describe('inspectionMarkers', () => {
  it('keeps the registered site apart from the positions read in the field', () => {
    const detail = {
      site: {
        id: 's',
        name: 'Fábrica',
        addressLine: null,
        latitude: -23.5015,
        longitude: -47.4526,
      },
      startLocation: { status: 'captured', position: POSITION },
      completionLocation: { status: 'missing', reason: 'PERMISSION_DENIED' },
    } as unknown as InspectionDetail;

    expect(inspectionMarkers(detail).map((marker) => marker.kind)).toEqual(['site', 'start']);
  });
});
