import { fail, ok } from './result';

describe('ok', () => {
  it('wraps a value as a successful result', () => {
    expect(ok('valor')).toEqual({ ok: true, value: 'valor' });
  });
});

describe('fail', () => {
  it('wraps an error as a failed result', () => {
    expect(fail('motivo')).toEqual({ ok: false, error: 'motivo' });
  });
});
