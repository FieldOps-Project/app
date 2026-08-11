import type { InspectionSummary } from '@/domain/inspection';

/**
 * Fixed inspections used while the API integration is not delivered.
 *
 * They exist so the parameterized routes have real identifiers to carry. The
 * list is replaced by the API query in EP-03 without any route changing.
 */
export const sampleInspections: readonly InspectionSummary[] = [
  {
    id: 'INS-2401',
    client: 'Padaria Aurora',
    address: 'Rua das Palmeiras, 120 — Centro',
    scheduledFor: 'Hoje, 09:00',
    status: 'em-andamento',
    syncState: 'aguardando-envio',
  },
  {
    id: 'INS-2402',
    client: 'Mercado São Jorge',
    address: 'Av. Brasil, 4500 — Jardim América',
    scheduledFor: 'Hoje, 14:30',
    status: 'pendente',
    syncState: 'salvo-no-dispositivo',
  },
  {
    id: 'INS-2403',
    client: 'Restaurante Bem Servido',
    address: 'Rua Ipiranga, 78 — Vila Nova',
    scheduledFor: 'Amanhã, 08:15',
    status: 'concluida',
    syncState: 'enviado',
  },
];

/**
 * Finds one inspection by identifier.
 *
 * @param inspectionId Identifier taken from the route parameter.
 * @returns The inspection, or `undefined` when the identifier does not exist.
 */
export function findInspection(inspectionId: string): InspectionSummary | undefined {
  return sampleInspections.find((inspection) => inspection.id === inspectionId);
}
