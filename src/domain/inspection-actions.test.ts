import {
  canEditAnswers,
  canEditItem,
  canReopen,
  correctionScope,
  requiresCorrection,
  canStart,
  contextualAction,
  isAwaitingSend,
  startBlockedReason,
} from '@/domain/inspection-actions';
import { INSPECTION_STATUSES } from '@/domain/inspection';

describe('contextualAction', () => {
  it('offers the single action of each state (card #11)', () => {
    expect(contextualAction('ASSIGNED')).toBe('START');
    expect(contextualAction('IN_PROGRESS')).toBe('CONTINUE');
    expect(contextualAction('REJECTED')).toBe('CORRECT');
    for (const status of ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CANCELED'] as const) {
      expect(contextualAction(status)).toBe('VIEW');
    }
  });
});

describe('canStart', () => {
  it('allows only an assigned inspection (RN-032)', () => {
    expect(INSPECTION_STATUSES.filter(canStart)).toEqual(['ASSIGNED']);
  });

  it('explains a canceled inspection in business language (RN-077)', () => {
    expect(startBlockedReason('CANCELED')).toMatch(/cancelada/);
    expect(startBlockedReason('ASSIGNED')).toBeNull();
  });
});

describe('canEditAnswers', () => {
  it('locks answers outside IN_PROGRESS (RN-043)', () => {
    expect(INSPECTION_STATUSES.filter(canEditAnswers)).toEqual(['IN_PROGRESS']);
  });
});

describe('startBlockedReason', () => {
  it('points a rejected inspection to the correction, not to a finished one', () => {
    expect(startBlockedReason('REJECTED')).toMatch(/reabertura para correção/);
  });
});

describe('isAwaitingSend', () => {
  it('is a local completion the server has not confirmed yet', () => {
    expect(isAwaitingSend('SUBMITTED', 'aguardando-envio')).toBe(true);
    expect(isAwaitingSend('SUBMITTED', 'falha')).toBe(true);
    expect(isAwaitingSend('SUBMITTED', 'enviado')).toBe(false);
    expect(isAwaitingSend('IN_PROGRESS', 'aguardando-envio')).toBe(false);
  });
});

describe('correction after a rejection (RN-043, RN-083)', () => {
  const some = { decision: 'REJECTED', reason: 'Horímetro', itemsToCorrect: ['a', 'b'] } as const;
  const whole = { decision: 'REJECTED', reason: 'Refazer', itemsToCorrect: [] } as const;

  it('reopens only a rejected inspection, and by explicit action', () => {
    expect(INSPECTION_STATUSES.filter(canReopen)).toEqual(['REJECTED']);
    expect(INSPECTION_STATUSES.filter(requiresCorrection)).toEqual(['REJECTED']);
  });

  it('limits the edit to the items the supervisor pointed out', () => {
    expect(canEditItem('IN_PROGRESS', some, 'a')).toBe(true);
    expect(canEditItem('IN_PROGRESS', some, 'z')).toBe(false);
    expect([...(correctionScope('IN_PROGRESS', some) ?? [])]).toEqual(['a', 'b']);
  });

  it('reopens the whole inspection when no item was pointed out', () => {
    expect(correctionScope('IN_PROGRESS', whole)).toBeNull();
    expect(canEditItem('IN_PROGRESS', whole, 'z')).toBe(true);
  });

  it('does not restrict an inspection that was never rejected', () => {
    expect(correctionScope('IN_PROGRESS', null)).toBeNull();
    expect(canEditItem('IN_PROGRESS', null, 'z')).toBe(true);
  });

  it('keeps every item read-only while the inspection is not open for editing', () => {
    expect(canEditItem('REJECTED', some, 'a')).toBe(false);
    expect(canEditItem('SUBMITTED', null, 'a')).toBe(false);
  });
});
