import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { SessionProvider, useSession } from '@/application/session/session-context';
import type { Session } from '@/domain/session';
import { login, logout } from '@/infrastructure/api';
import { clearSession, readSession, writeSession } from '@/infrastructure/storage/session-storage';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));

jest.mock('@/infrastructure/api', () => ({
  ...jest.requireActual('@/infrastructure/api'),
  login: jest.fn(),
  logout: jest.fn(),
}));

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

jest.mock('@/infrastructure/storage/session-storage', () => {
  let mockStored: unknown = null;
  return {
    readSession: jest.fn(async () => mockStored),
    writeSession: jest.fn(async (session: unknown) => {
      mockStored = session;
    }),
    clearSession: jest.fn(async () => {
      mockStored = null;
    }),
  };
});

const USER: Session = {
  userId: 'u-1',
  name: 'Carlos',
  email: 'carlos@fieldops.local',
  role: 'TECHNICIAN',
};
const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 0 };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let current: ReturnType<typeof useSession>;
let renderer: ReactTestRenderer | undefined;
let queryClient: QueryClient;

/** Hands the latest context value to the test from an effect, not from render. */
function Probe({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useSession>) => void;
}): ReactNode {
  const value = useSession();
  useEffect(() => {
    onValue(value);
  });
  return null;
}

async function mountProvider() {
  queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(['cached'], 'server data');
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Probe
            onValue={(value) => {
              current = value;
            }}
          />
        </SessionProvider>
      </QueryClientProvider>
    );
  });
}

beforeEach(async () => {
  await clearTokens();
  await clearSession();
  jest.clearAllMocks();
  jest.mocked(logout).mockResolvedValue({ ok: true, value: undefined });
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
});

describe('session restore', () => {
  it('restores a stored session together with its tokens', async () => {
    await writeSession(USER);
    await writeTokens(TOKENS);

    await mountProvider();

    expect(current.isRestoring).toBe(false);
    expect(current.session).toEqual(USER);
  });

  it('treats a profile without tokens as signed out and clears the leftover', async () => {
    await writeSession(USER);

    await mountProvider();

    expect(current.session).toBeNull();
    expect(await readSession()).toBeNull();
  });
});

describe('signIn', () => {
  it('keeps the tokens and the profile in secure storage', async () => {
    jest.mocked(login).mockResolvedValue({ ok: true, value: { tokens: TOKENS, user: USER } });
    await mountProvider();

    await act(async () => {
      await current.signIn({ email: USER.email, password: 'secret' });
    });

    expect(current.session).toEqual(USER);
    expect(writeTokens).toHaveBeenCalledWith(TOKENS);
    expect(writeSession).toHaveBeenCalledWith(USER);
  });
});

describe('signOut', () => {
  beforeEach(async () => {
    await writeSession(USER);
    await writeTokens(TOKENS);
    await mountProvider();
  });

  it('revokes the refresh token on the API and clears the device', async () => {
    await act(() => current.signOut());

    expect(logout).toHaveBeenCalledWith('refresh-1');
    expect(current.session).toBeNull();
    expect(await readTokens()).toBeNull();
    expect(await readSession()).toBeNull();
  });

  it('clears the local credentials before asking the API to revoke', async () => {
    await act(() => current.signOut());

    const cleared = jest.mocked(clearTokens).mock.invocationCallOrder[0] ?? 0;
    const revoked = jest.mocked(logout).mock.invocationCallOrder[0] ?? 0;
    expect(cleared).toBeGreaterThan(0);
    expect(cleared).toBeLessThan(revoked);
  });

  it('drops the cached server data so the next person never sees it', async () => {
    await act(() => current.signOut());

    expect(queryClient.getQueryData(['cached'])).toBeUndefined();
  });

  it('signs out even when the revocation cannot reach the API', async () => {
    jest.mocked(logout).mockResolvedValue({ ok: false, error: { kind: 'network' } });

    await act(() => current.signOut());

    expect(current.session).toBeNull();
    expect(await readTokens()).toBeNull();
  });
});
