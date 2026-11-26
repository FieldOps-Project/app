import { fail, ok } from '@/domain/result';
import { login } from '@/infrastructure/api/auth-api';
import { request } from '@/infrastructure/api/http-client';

jest.mock('@/infrastructure/api/http-client', () => ({ request: jest.fn() }));

function loginBody(role: string) {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: 900,
    user: { id: 'u-1', name: 'Ana', email: 'ana@fieldops.com', role },
  };
}

beforeEach(() => {
  jest.mocked(request).mockReset();
});

describe('login', () => {
  it.each(['TECHNICIAN', 'SUPERVISOR', 'ADMIN'])('opens a session for %s', async (role) => {
    jest.mocked(request).mockResolvedValue(ok(loginBody(role)));

    const result = await login({ email: 'ana@fieldops.com', password: 'secret' });

    expect(result.ok && result.value.user.role).toBe(role);
  });

  it('refuses a client viewer, who does not use the field app, and revokes the new tokens', async () => {
    jest
      .mocked(request)
      .mockResolvedValueOnce(ok(loginBody('CLIENT_VIEWER')))
      .mockResolvedValue(ok(undefined));

    const result = await login({ email: 'cliente@abc.com', password: 'secret' });

    expect(result).toEqual(fail({ kind: 'forbidden' }));
    expect(jest.mocked(request).mock.calls[1]?.[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/logout',
    });
  });

  it('fails as a server error when the reply has an unknown role', async () => {
    jest.mocked(request).mockResolvedValue(ok(loginBody('ROOT')));

    expect(await login({ email: 'a@b.com', password: 'x' })).toEqual(fail({ kind: 'server' }));
  });
});
