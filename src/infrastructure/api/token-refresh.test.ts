import {
  fakeAdapter,
  RENEWED_TOKENS_BODY,
  type Reply,
} from '@/infrastructure/api/testing/fake-api';
import {
  onSessionRejected,
  refreshClient,
  refreshSession,
} from '@/infrastructure/api/token-refresh';
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

let calls: { body: unknown; authorization: unknown }[];
let paths: (string | undefined)[];
let reply: Reply | (() => Promise<Reply>);
let rejectedListener: jest.Mock;
let unsubscribe: () => void;

beforeEach(async () => {
  calls = [];
  paths = [];
  reply = { status: 200, data: RENEWED_TOKENS_BODY };
  refreshClient.defaults.adapter = fakeAdapter(async (config) => {
    calls.push({
      body: JSON.parse(String(config.data)),
      authorization: config.headers.get('Authorization'),
    });
    paths.push(config.url);
    return typeof reply === 'function' ? reply() : reply;
  });
  await writeTokens(SIGNED_IN);
  jest.clearAllMocks();
  rejectedListener = jest.fn();
  unsubscribe = onSessionRejected(rejectedListener);
});

afterEach(() => unsubscribe());

describe('refreshSession', () => {
  it('stores the renewed tokens and sends only the refresh token', async () => {
    const before = Date.now();

    await expect(refreshSession()).resolves.toEqual({ kind: 'refreshed' });

    expect(calls).toEqual([{ body: { refreshToken: 'refresh-1' }, authorization: undefined }]);
    const stored = await readTokens();
    expect(stored).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(stored?.expiresAt).toBeGreaterThanOrEqual(before + 900 * 1000);
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it.each([401, 403])('ends the session when the server answers %i', async (status) => {
    reply = { status, data: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'x' } };

    await expect(refreshSession()).resolves.toEqual({ kind: 'rejected' });

    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(await readTokens()).toBeNull();
    expect(rejectedListener).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when there is no network', async () => {
    reply = 'network';

    await expect(refreshSession()).resolves.toEqual({ kind: 'unavailable', failure: 'network' });

    expect(await readTokens()).toEqual(SIGNED_IN);
    expect(clearTokens).not.toHaveBeenCalled();
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('keeps the session when the server fails', async () => {
    reply = { status: 503 };

    await expect(refreshSession()).resolves.toEqual({ kind: 'unavailable', failure: 'server' });

    expect(await readTokens()).toEqual(SIGNED_IN);
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('keeps the session and the old tokens when the answer is malformed', async () => {
    reply = { status: 200, data: { accessToken: 'only-this' } };

    await expect(refreshSession()).resolves.toEqual({ kind: 'unavailable', failure: 'server' });

    expect(await readTokens()).toEqual(SIGNED_IN);
  });

  it('does not announce an expiry when nobody is signed in', async () => {
    await clearTokens();
    jest.clearAllMocks();

    await expect(refreshSession()).resolves.toEqual({ kind: 'rejected' });

    expect(calls).toHaveLength(0);
    expect(rejectedListener).not.toHaveBeenCalled();
  });

  it('does not bring back a session that was signed out during the refresh', async () => {
    reply = async () => {
      await clearTokens();
      return { status: 200, data: RENEWED_TOKENS_BODY };
    };

    await expect(refreshSession()).resolves.toEqual({ kind: 'rejected' });

    expect(await readTokens()).toBeNull();
    expect(rejectedListener).not.toHaveBeenCalled();
    expect(paths).toEqual(['/api/v1/auth/refresh', '/api/v1/auth/logout']);
    expect(calls[1]?.body).toEqual({ refreshToken: RENEWED_TOKENS_BODY.refreshToken });
  });

  it('shares one round trip between concurrent callers', async () => {
    const outcomes = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(calls).toHaveLength(1);
    expect(outcomes).toEqual([{ kind: 'refreshed' }, { kind: 'refreshed' }, { kind: 'refreshed' }]);
  });

  it('refreshes again for a later caller once the first attempt has settled', async () => {
    await refreshSession();
    await refreshSession();

    expect(calls.map((call) => call.body)).toEqual([
      { refreshToken: 'refresh-1' },
      { refreshToken: 'refresh-2' },
    ]);
  });

  it('stops notifying a listener after it unsubscribes', async () => {
    unsubscribe();
    reply = { status: 401 };

    await refreshSession();

    expect(rejectedListener).not.toHaveBeenCalled();
  });
});
