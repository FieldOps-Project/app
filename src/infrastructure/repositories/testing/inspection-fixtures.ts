import type { ChecklistResponse } from '@/domain/checklist';
import type { MobileInspection } from '@/schemas/mobile-inspection';

export const FIXTURE_TIME = '2026-08-12T13:00:00.000Z';

export function remoteInspection(overrides: Partial<MobileInspection> = {}): MobileInspection {
  return {
    id: 'insp-1',
    title: 'Inspeção do gerador',
    status: 'ASSIGNED',
    priority: 'HIGH',
    scheduledFor: '2026-08-12T13:00:00Z',
    instructions: 'Desligar antes.',
    version: 3,
    updatedAt: 'v3',
    startedAtDevice: null,
    completedAtDevice: null,
    startLocation: null,
    completionLocation: null,
    client: { id: 'c-1', name: 'Indústria ABC' },
    site: { id: 's-1', name: 'Fábrica', addressLine: null, latitude: -23.5, longitude: -47.4 },
    equipment: null,
    items: [
      {
        id: 'item-1',
        sectionTitle: 'Geral',
        sectionDescription: null,
        sectionOrder: 1,
        itemCode: null,
        itemTitle: 'Proteção lateral',
        itemDescription: null,
        responseType: 'CONFORMITY',
        required: true,
        rules: {
          observationRequiredOnFailure: true,
          evidenceRequiredOnFailure: false,
          min: null,
          max: null,
        },
        options: [],
        itemOrder: 1,
      },
    ],
    responses: [],
    review: null,
    ...overrides,
  };
}

export function checklistAnswer(overrides: Partial<ChecklistResponse> = {}): ChecklistResponse {
  return {
    id: 'resp-1',
    inspectionItemId: 'item-1',
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: 'CONFORMING',
    observation: null,
    answeredAtDevice: FIXTURE_TIME,
    ...overrides,
  };
}
