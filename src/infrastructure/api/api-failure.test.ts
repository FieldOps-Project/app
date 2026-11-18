import { describeApiFailure, describeBusinessFailure } from '@/infrastructure/api/api-failure';

describe('describeApiFailure', () => {
  it('never shows the text the server sent with a business refusal', () => {
    const text = describeApiFailure({
      kind: 'business',
      code: 'INSPECTION_INVALID_TRANSITION',
      message: 'Cannot transition inspection 7f3c from ASSIGNED to SUBMITTED',
    });

    expect(text).toBe('O servidor não aceita esta etapa no estado atual da inspeção.');
    expect(text).not.toMatch(/ASSIGNED|SUBMITTED|7f3c/);
  });

  it('falls back to a generic sentence for a code the app does not know', () => {
    const text = describeApiFailure({
      kind: 'business',
      code: 'SOMETHING_NEW',
      message: 'NullPointerException at InspectionService',
    });

    expect(text).toBe(describeBusinessFailure('UNKNOWN'));
    expect(text).not.toContain('NullPointer');
  });

  it.each([
    [{ kind: 'unauthorized' as const }, 'Sua sessão expirou'],
    [{ kind: 'forbidden' as const }, 'Você não tem permissão'],
    [{ kind: 'notFound' as const }, 'Não encontramos este registro'],
    [{ kind: 'conflict' as const, code: 'SYNC_VERSION_CONFLICT' }, 'mudou em outro lugar'],
    [{ kind: 'server' as const }, 'O servidor está com problemas'],
  ])('describes %j in plain Portuguese', (failure, expected) => {
    const text = describeApiFailure(failure);

    expect(text).toContain(expected);
    expect(text).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
  });
});
