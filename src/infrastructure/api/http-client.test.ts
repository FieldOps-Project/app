import { httpClient, request } from '@/infrastructure/api/http-client';
import {
  fakeAdapter,
  RENEWED_TOKENS_BODY,
  type Reply,
} from '@/infrastructure/api/testing/fake-api';
import { onSessionRejected, refreshClient } from '@/infrastructure/api/token-refresh';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));

jest.mock('@/infrastructure/storage/token-storage', () => {
  let mockStored: unknown = null;
  return {
    readTokens: jest.fn(async () => mockStored),
    writeTokens: jest.fn(async (tokens: unknown) => {
      mockStored = tokens;
    }),
    clearTokens: jest.fn(async () => {
      mockStored = null;
    }),
  };
});

const SIGNED_IN = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 0 };

/** Authorization header of every call that reached the fake server, in order. */
let apiCalls: { path: string | undefined; authorization: unknown }[];
let refreshCalls: number;
let refreshReply: Reply;
let rejectedListener: jest.Mock;
let unsubscribe: () => void;

/** Answers 401 to any token but the renewed one, like a server whose first token expired. */
function acceptOnlyRenewedToken() {
  httpClient.defaults.adapter = fakeAdapter((config) => {
    const authorization = config.headers.get('Authorization');
    apiCalls.push({ path: config.url, authorization });
    return authorization === 'Bearer access-2'
      ? { status: 200, data: { ok: true } }
      : { status: 401, data: { code: 'AUTH_INVALID_TOKEN', message: 'x' } };
  });
}

beforeEach(async () => {
  apiCalls = [];
  refreshCalls = 0;
  refreshReply = { status: 200, data: RENEWED_TOKENS_BODY };
  refreshClient.defaults.adapter = fakeAdapter(() => {
    refreshCalls += 1;
    return refreshReply;
  });
  await writeTokens(SIGNED_IN);
  jest.clearAllMocks();
  rejectedListener = jest.fn();
  unsubscribe = onSessionRejected(rejectedListener);
  acceptOnlyRenewedToken();
});

afterEach(() => unsubscribe());

describe('httpClient token renewal', () => {
  it('renews an expired token and repeats the request with the new one', async () => {
    const result = await request<{ ok: boolean }>({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: true, value: { ok: true } });
    expect(refreshCalls).toBe(1);
    expect(apiCalls.map((call) => call.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('does not renew when the token is still good', async () => {
    await writeTokens({ ...SIGNED_IN, accessToken: 'access-2' });

    await request({ path: '/api/v1/things' });

    expect(refreshCalls).toBe(0);
    expect(apiCalls).toHaveLength(1);
  });

  it('shares a single refresh between requests that expire together', async () => {
    const results = await Promise.all([
      request({ path: '/api/v1/a' }),
      request({ path: '/api/v1/b' }),
      request({ path: '/api/v1/c' }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  /** The request is sent with access-1, but by the time its 401 arrives the tokens have rotated. */
  it('repeats a request that another refresh already overtook without refreshing again', async () => {
    httpClient.defaults.adapter = fakeAdapter(async (config) => {
      const authorization = config.headers.get('Authorization');
      apiCalls.push({ path: config.url, authorization });
      if (authorization === 'Bearer access-1') {
        await writeTokens({ accessToken: 'access-2', refreshToken: 'refresh-2', expiresAt: 0 });
        return { status: 401 };
      }
      return { status: 200, data: { ok: true } };
    });

    const result = await request({ path: '/api/v1/things' });

    expect(result.ok).toBe(true);
    expect(refreshCalls).toBe(0);
    expect(apiCalls.map((call) => call.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  it('repeats at most once, so a request that keeps failing cannot loop', async () => {
    httpClient.defaults.adapter = fakeAdapter((config) => {
      apiCalls.push({ path: config.url, authorization: config.headers.get('Authorization') });
      return { status: 401 };
    });

    const result = await request({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(apiCalls).toHaveLength(2);
    expect(refreshCalls).toBe(1);
  });

  it('returns unauthorized and ends the session when the server refuses the refresh', async () => {
    refreshReply = { status: 401 };

    const result = await request({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(apiCalls).toHaveLength(1);
    expect(await readTokens()).toBeNull();
    expect(rejectedListener).toHaveBeenCalledTimes(1);
  });

  it('reports offline, and keeps the session, when the refresh cannot reach the server', async () => {
    refreshReply = 'network';

    const result = await request({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: false, error: { kind: 'network' } });
    expect(await readTokens()).toEqual(SIGNED_IN);
    expect(clearTokens).not.toHaveBeenCalled();
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('reports a server fault, and keeps the session, when the refresh gets a 5xx', async () => {
    refreshReply = { status: 500 };

    const result = await request({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: false, error: { kind: 'server' } });
    expect(await readTokens()).toEqual(SIGNED_IN);
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('does not try to renew a rejected login', async () => {
    const result = await request({ method: 'POST', path: '/api/v1/auth/login', data: {} });

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(refreshCalls).toBe(0);
    expect(apiCalls).toHaveLength(1);
  });

  it('does not try to renew when nobody is signed in', async () => {
    await clearTokens();

    const result = await request({ path: '/api/v1/things' });

    expect(result).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(refreshCalls).toBe(0);
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('still renews /auth/me, which is an ordinary authenticated call', async () => {
    const result = await request({ path: '/api/v1/auth/me' });

    expect(result.ok).toBe(true);
    expect(refreshCalls).toBe(1);
  });
});
