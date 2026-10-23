import type { ChecklistItem, ChecklistResponse } from '@/domain/checklist';
import { computeProgress, nextPending } from '@/domain/checklist-progress';

function item(id: string, overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id,
    sectionTitle: 'Geral',
    sectionDescription: null,
    sectionOrder: 1,
    itemCode: null,
    itemTitle: `Item ${id}`,
    itemDescription: null,
    responseType: 'CONFORMITY',
    required: true,
    rules: {
      observationRequiredOnFailure: false,
      evidenceRequiredOnFailure: false,
      min: null,
      max: null,
    },
    options: [],
    itemOrder: Number(id.replace(/\D/g, '')) || 1,
    ...overrides,
  };
}

function answer(itemId: string, overrides: Partial<ChecklistResponse> = {}): ChecklistResponse {
  return {
    id: `r-${itemId}`,
    inspectionItemId: itemId,
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    conformity: 'CONFORMING',
    observation: null,
    answeredAtDevice: '2026-08-12T10:00:00Z',
    ...overrides,
  };
}

function progressOf(
  items: ChecklistItem[],
  responses: ChecklistResponse[],
  evidence: [string, number][] = []
) {
  return computeProgress({
    items,
    responses: new Map(responses.map((response) => [response.inspectionItemId, response])),
    evidenceCounts: new Map(evidence),
  });
}

describe('computeProgress', () => {
  it('measures answered over applicable items (RN-040)', () => {
    const progress = progressOf([item('i1'), item('i2'), item('i3'), item('i4')], [answer('i1')]);

    expect(progress).toMatchObject({ total: 4, answered: 1, applicable: 4, percent: 25 });
  });

  it('treats "não aplicável" as resolved, not pending', () => {
    const progress = progressOf(
      [item('i1'), item('i2')],
      [answer('i1'), answer('i2', { conformity: 'NOT_APPLICABLE' })]
    );

    expect(progress).toMatchObject({ answered: 1, applicable: 1, percent: 100 });
    expect(progress.pending).toEqual([]);
  });

  it('lists the three kinds of blocking items (RN-037, RN-038, RN-039)', () => {
    const failureRules = {
      observationRequiredOnFailure: true,
      evidenceRequiredOnFailure: true,
      min: null,
      max: null,
    };
    const progress = progressOf(
      [item('i1'), item('i2', { rules: failureRules }), item('i3', { rules: failureRules })],
      [
        answer('i2', { conformity: 'NON_CONFORMING' }),
        answer('i3', { conformity: 'NON_CONFORMING', observation: 'Trinca na proteção.' }),
      ]
    );

    expect(progress.pending.map((pending) => [pending.itemId, pending.reason])).toEqual([
      ['i1', 'REQUIRED_UNANSWERED'],
      ['i2', 'OBSERVATION_REQUIRED'],
      ['i2', 'EVIDENCE_REQUIRED'],
      ['i3', 'EVIDENCE_REQUIRED'],
    ]);
    expect(progress.nonConformities).toBe(2);
  });

  it('accepts a failure once its evidence exists', () => {
    const rules = {
      observationRequiredOnFailure: false,
      evidenceRequiredOnFailure: true,
      min: null,
      max: null,
    };
    const progress = progressOf(
      [item('i1', { rules })],
      [answer('i1', { conformity: 'NON_CONFORMING' })],
      [['i1', 1]]
    );

    expect(progress.pending).toEqual([]);
  });

  it('never lets an optional item block, answered or not', () => {
    expect(progressOf([item('i1', { required: false })], []).pending).toEqual([]);
  });

  it('blocks on a required item of an unknown type and never reads 100% because of it', () => {
    const progress = progressOf(
      [item('i1'), item('i2', { responseType: 'THERMAL_IMAGE' })],
      [answer('i1')]
    );

    expect(progress).toMatchObject({ answered: 1, applicable: 2, percent: 50 });
    expect(progress.pending).toEqual([
      expect.objectContaining({ itemId: 'i2', reason: 'UNSUPPORTED_TYPE' }),
    ]);
  });

  it('leaves an optional item of an unknown type out of the progress', () => {
    const progress = progressOf(
      [item('i1'), item('i2', { responseType: 'THERMAL_IMAGE', required: false })],
      [answer('i1')]
    );

    expect(progress).toMatchObject({ applicable: 1, percent: 100, pending: [] });
  });

  it('reports a missing observation and a missing evidence together', () => {
    const rules = {
      observationRequiredOnFailure: true,
      evidenceRequiredOnFailure: true,
      min: null,
      max: null,
    };
    const progress = progressOf(
      [item('i1', { rules })],
      [answer('i1', { conformity: 'NON_CONFORMING' })]
    );

    expect(progress.pending.map((pending) => pending.reason)).toEqual([
      'OBSERVATION_REQUIRED',
      'EVIDENCE_REQUIRED',
    ]);
  });

  it('reports each section and whether it is complete', () => {
    const progress = progressOf(
      [item('a1'), item('b1', { sectionOrder: 2, sectionTitle: 'Elétrica' })],
      [answer('a1')]
    );

    expect(progress.sections).toEqual([
      { order: 1, title: 'Geral', answered: 1, applicable: 1, complete: true },
      { order: 2, title: 'Elétrica', answered: 0, applicable: 1, complete: false },
    ]);
  });

  it('never rounds an unfinished checklist up to 100%', () => {
    const items = Array.from({ length: 300 }, (_, index) => item(`i${index + 1}`));
    const responses = items.slice(0, 299).map((entry) => answer(entry.id));

    expect(progressOf(items, responses).percent).toBe(99);
  });
});

describe('nextPending', () => {
  const items = [item('i1'), item('i2'), item('i3')];
  const progress = progressOf(items, [answer('i2')]);

  it('goes to the next pending item after the current one', () => {
    expect(nextPending(progress, items, 'i1')?.itemId).toBe('i3');
  });

  it('wraps around to the first pending item', () => {
    expect(nextPending(progress, items, 'i3')?.itemId).toBe('i1');
  });

  it('starts from the top without a current item', () => {
    expect(nextPending(progress, items, null)?.itemId).toBe('i1');
  });
});
