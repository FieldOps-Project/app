import type { ChecklistResponse } from '@/domain/checklist';
import {
  blockingCompletion,
  canDeleteLocally,
  isSeverity,
  lacksRequiredEvidence,
  SEVERITIES,
  SEVERITY_LABELS,
  suggestsNonConformity,
  type NonConformity,
} from '@/domain/non-conformity';

function nonConformity(overrides: Partial<NonConformity> = {}): NonConformity {
  return {
    id: 'nc-1',
    inspectionId: 'insp-1',
    inspectionItemId: 'item-1',
    itemTitle: 'Proteção lateral',
    title: 'Trinca',
    description: 'Trinca de 5 cm.',
    severity: 'HIGH',
    createdAtDevice: '2026-08-12T13:00:00.000Z',
    syncState: 'aguardando-envio',
    evidenceCount: 0,
    ...overrides,
  };
}

describe('severity', () => {
  it('has the four levels of RN-054, each with a text label', () => {
    expect(SEVERITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(SEVERITIES.map((severity) => SEVERITY_LABELS[severity])).toEqual([
      'Baixa',
      'Média',
      'Alta',
      'Crítica',
    ]);
  });

  it('recognises only the valid levels', () => {
    expect(isSeverity('CRITICAL')).toBe(true);
    expect(isSeverity('critical')).toBe(false);
    expect(isSeverity('URGENT')).toBe(false);
  });
});

describe('evidence required by a critical severity (RN-055)', () => {
  it('asks for evidence only when the severity is critical and there is none', () => {
    expect(lacksRequiredEvidence(nonConformity({ severity: 'CRITICAL', evidenceCount: 0 }))).toBe(
      true
    );
    expect(lacksRequiredEvidence(nonConformity({ severity: 'CRITICAL', evidenceCount: 1 }))).toBe(
      false
    );
    expect(lacksRequiredEvidence(nonConformity({ severity: 'HIGH', evidenceCount: 0 }))).toBe(
      false
    );
  });

  it('lists the registrations that block the completion', () => {
    const blocked = nonConformity({ id: 'a', severity: 'CRITICAL' });
    const fine = nonConformity({ id: 'b', severity: 'CRITICAL', evidenceCount: 2 });

    expect(blockingCompletion([blocked, fine])).toEqual([blocked]);
  });
});

describe('suggestsNonConformity', () => {
  const answer = (conformity: ChecklistResponse['conformity']) =>
    ({ conformity }) as ChecklistResponse;

  it('suggests a registration for a non-conforming answer only', () => {
    expect(suggestsNonConformity(answer('NON_CONFORMING'))).toBe(true);
    expect(suggestsNonConformity(answer('CONFORMING'))).toBe(false);
    expect(suggestsNonConformity(answer('NOT_APPLICABLE'))).toBe(false);
    expect(suggestsNonConformity(undefined)).toBe(false);
  });
});

describe('canDeleteLocally (RN-056)', () => {
  it('allows deleting what has not been sent, and never what was', () => {
    expect(canDeleteLocally(nonConformity({ syncState: 'aguardando-envio' }))).toBe(true);
    expect(canDeleteLocally(nonConformity({ syncState: 'falha' }))).toBe(true);
    expect(canDeleteLocally(nonConformity({ syncState: 'enviado' }))).toBe(false);
  });
});
