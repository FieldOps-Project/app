import type { InspectionSummary } from '@/domain/inspection';

/** Fixed data so the parameterized routes carry real identifiers. Replaced by the device store in EP-06. */
export const sampleInspections: readonly InspectionSummary[] = [
  {
    id: 'INS-2401',
    title: 'Ronda de segurança mensal',
    clientName: 'Padaria Aurora',
    siteName: 'Rua das Palmeiras, 120 — Centro',
    equipmentName: null,
    priority: 'MEDIUM',
    scheduledFor: '2026-10-23T12:00:00Z',
    status: 'IN_PROGRESS',
    syncState: 'aguardando-envio',
  },
  {
    id: 'INS-2402',
    title: 'Vistoria do quadro elétrico',
    clientName: 'Mercado São Jorge',
    siteName: 'Av. Brasil, 4500 — Jardim América',
    equipmentName: null,
    priority: 'HIGH',
    scheduledFor: '2026-10-23T17:30:00Z',
    status: 'ASSIGNED',
    syncState: 'salvo-no-dispositivo',
  },
  {
    id: 'INS-2403',
    title: 'Inspeção sanitária',
    clientName: 'Restaurante Bem Servido',
    siteName: 'Rua Ipiranga, 78 — Vila Nova',
    equipmentName: null,
    priority: 'LOW',
    scheduledFor: '2026-10-24T11:15:00Z',
    status: 'SUBMITTED',
    syncState: 'enviado',
  },
];

export function findInspection(inspectionId: string): InspectionSummary | undefined {
  return sampleInspections.find((inspection) => inspection.id === inspectionId);
}
