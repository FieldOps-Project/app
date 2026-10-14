import { create as createAxiosInstance, isAxiosError } from 'axios';

import { env } from '@/config/env';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';
import type { AuthTokens } from '@/infrastructure/storage/token-storage';

const REFRESH_PATH = '/api/v1/auth/refresh';
const REFRESH_TIMEOUT_MS = 15_000;

/**
 * A client of its own, with none of `httpClient`'s interceptors. The refresh
 * call must not carry the expired bearer token and must never be itself
 * refreshed on a 401, which would loop.
 */
export const refreshClient = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REFRESH_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

/**
 * How a renewal attempt ended, in the terms the caller needs to act on.
 *
 * The distinction between `rejected` and `unavailable` is the point of the
 * whole flow: with no signal the refresh never reaches the server, and that
 * must not sign the technician out in the middle of the field. The session
 * ends only when the server itself refuses the refresh token.
 */
export type RefreshOutcome =
  /** New tokens are stored; the original request can be repeated. */
  | { kind: 'refreshed' }
  /** The server refused the refresh token (or none is stored). Tokens are cleared. */
  | { kind: 'rejected' }
  /** No answer worth trusting — offline, timeout or a server fault. The session stays. */
  | { kind: 'unavailable'; failure: 'network' | 'server' };

/**
 * Raised to the caller of a request whose 401 could not be renewed because the
 * renewal itself was unreachable. It maps to the same `network`/`server`
 * failure a direct call would have produced, instead of a misleading
 * "session expired".
 */
export class RefreshUnavailableError extends Error {
  constructor(readonly failure: 'network' | 'server') {
    super('Session refresh unavailable');
    this.name = 'RefreshUnavailableError';
  }
}

interface RefreshResponseBody {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

type SessionRejectedListener = () => void;
const sessionRejectedListeners = new Set<SessionRejectedListener>();

/**
 * Subscribes to the server refusing to renew the session. The session state
 * lives in the application layer, which cannot be imported from here, so it
 * listens instead. Returns the unsubscribe function.
 */
export function onSessionRejected(listener: SessionRejectedListener): () => void {
  sessionRejectedListeners.add(listener);
  return () => {
    sessionRejectedListeners.delete(listener);
  };
}

let inFlight: Promise<RefreshOutcome> | null = null;

/**
 * Renews the session, sharing one attempt between every caller.
 *
 * Refresh tokens rotate: each use revokes the previous one. Requests that
 * expire together and each refreshed on their own would invalidate one
 * another, so the first caller starts the round trip and the rest await it.
 */
export function refreshSession(): Promise<RefreshOutcome> {
  inFlight ??= performRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function performRefresh(): Promise<RefreshOutcome> {
  const tokens = await readTokens();
  if (tokens === null) {
    return endSession();
  }

  try {
    const response = await refreshClient.post<RefreshResponseBody>(REFRESH_PATH, {
      refreshToken: tokens.refreshToken,
    });

    const renewed = toTokens(response.data);
    if (renewed === null) {
      return { kind: 'unavailable', failure: 'server' };
    }

    await writeTokens(renewed);
    return { kind: 'refreshed' };
  } catch (cause) {
    if (isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)) {
      return endSession();
    }
    // No response at all is the offline / timeout case; anything else is a fault
    // on the server's side. Neither says the refresh token is bad.
    const failure = isAxiosError(cause) && cause.response === undefined ? 'network' : 'server';
    return { kind: 'unavailable', failure };
  }
}

/**
 * Drops the credentials and tells the app the session is over. Only tokens go:
 * anything the technician recorded on the device stays, because signing in
 * again must find the work where it was left (RN-066).
 */
async function endSession(): Promise<RefreshOutcome> {
  await clearTokens();
  sessionRejectedListeners.forEach((listener) => listener());
  return { kind: 'rejected' };
}

function toTokens(body: RefreshResponseBody): AuthTokens | null {
  const { accessToken, refreshToken, expiresIn } = body;
  if (accessToken === undefined || refreshToken === undefined || expiresIn === undefined) {
    return null;
  }
  return { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
}
