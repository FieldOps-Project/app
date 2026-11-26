import { sameAnswer, summarizeAnswer, type AnswerValues } from '@/domain/answer-summary';

const blank: AnswerValues = {
  valueText: null,
  valueNumber: null,
  valueBoolean: null,
  valueDate: null,
  conformity: null,
  observation: null,
};

describe('summarizeAnswer', () => {
  it.each([
    [{ conformity: 'NON_CONFORMING' as const }, 'Não conforme'],
    [{ valueBoolean: false }, 'Não'],
    [{ valueBoolean: true }, 'Sim'],
    [{ valueNumber: 1500 }, '1500'],
    [{ valueDate: '2026-11-25' }, '2026-11-25'],
    [{ valueText: '  ok  ' }, 'ok'],
    [{}, 'Sem resposta'],
  ])('describes %j as "%s"', (values, expected) => {
    expect(summarizeAnswer({ ...blank, ...values })).toBe(expected);
  });

  it('appends the observation to the value', () => {
    expect(
      summarizeAnswer({ ...blank, conformity: 'NON_CONFORMING', observation: 'Trinca na lateral.' })
    ).toBe('Não conforme — Observação: Trinca na lateral.');
  });

  it('shows an observation alone when there is no value', () => {
    expect(summarizeAnswer({ ...blank, observation: 'Sem acesso.' })).toBe(
      'Observação: Sem acesso.'
    );
  });

  it('keeps a zero as a value', () => {
    expect(summarizeAnswer({ ...blank, valueNumber: 0 })).toBe('0');
  });
});

describe('sameAnswer', () => {
  it('compares what the technician would read', () => {
    expect(sameAnswer({ ...blank, valueBoolean: true }, { ...blank, valueBoolean: true })).toBe(
      true
    );
    expect(sameAnswer({ ...blank, valueBoolean: true }, { ...blank, valueBoolean: false })).toBe(
      false
    );
  });
});
