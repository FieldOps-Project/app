import {
  canEditAnswers,
  canStart,
  contextualAction,
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
