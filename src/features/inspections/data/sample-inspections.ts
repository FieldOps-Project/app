import type { InspectionSummary } from '@/domain/inspection';

/** Fixed data so the parameterized routes carry real identifiers. Replaced in EP-03. */
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

export function findInspection(inspectionId: string): InspectionSummary | undefined {
  return sampleInspections.find((inspection) => inspection.id === inspectionId);
}
