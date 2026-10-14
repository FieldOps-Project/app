import { create as createAxiosInstance, isAxiosError } from 'axios';

import { env } from '@/config/env';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import { AUTH_PATHS } from '@/infrastructure/api/auth-paths';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';
import type { AuthTokens } from '@/infrastructure/storage/token-storage';

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
/** The failures that say the server could not be reached, not that the token is bad. */
export type UnreachableFailure = Extract<ApiFailure['kind'], 'network' | 'server'>;

export type RefreshOutcome =
  /** New tokens are stored; the original request can be repeated. */
  | { kind: 'refreshed' }
  /** The server refused the refresh token, or nobody is signed in any more. */
  | { kind: 'rejected' }
  /** No answer worth trusting — offline, timeout or a server fault. The session stays. */
  | { kind: 'unavailable'; failure: UnreachableFailure };

/**
 * Raised to the caller of a request whose 401 could not be renewed because the
 * renewal itself was unreachable. It maps to the same `network`/`server`
 * failure a direct call would have produced, instead of a misleading
 * "session expired".
 */
export class RefreshUnavailableError extends Error {
  constructor(readonly failure: UnreachableFailure) {
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

/**
 * Two cases end the attempt without telling anyone the session is over: no
 * tokens at the start, and tokens that changed while the request was in flight.
 * Both mean the person signed out (or in again) meanwhile — announcing an
 * expiry then would show "session expired" to someone who chose to leave, and
 * storing the renewed pair would bring a closed session back. The renewed
 * refresh token is revoked instead, so it does not stay valid on the server.
 */
async function performRefresh(): Promise<RefreshOutcome> {
  const tokens = await readTokens();
  if (tokens === null) {
    return { kind: 'rejected' };
  }

  try {
    const response = await refreshClient.post<RefreshResponseBody>(AUTH_PATHS.refresh, {
      refreshToken: tokens.refreshToken,
    });

    const renewed = toTokens(response.data);
    if (renewed === null) {
      return { kind: 'unavailable', failure: 'server' };
    }

    const current = await readTokens();
    if (current?.refreshToken !== tokens.refreshToken) {
      revokeQuietly(renewed.refreshToken);
      return { kind: 'rejected' };
    }

    await writeTokens(renewed);
    return { kind: 'refreshed' };
  } catch (cause) {
    if (isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)) {
      return endSession();
    }
    return { kind: 'unavailable', failure: toUnreachableFailure(cause) };
  }
}

/**
 * No response at all is the offline or timeout case; anything else is a fault
 * on the server's side. Neither says the refresh token is bad.
 */
function toUnreachableFailure(cause: unknown): UnreachableFailure {
  return isAxiosError(cause) && cause.response === undefined ? 'network' : 'server';
}

function revokeQuietly(refreshToken: string): void {
  refreshClient.post(AUTH_PATHS.logout, { refreshToken }).catch(() => undefined);
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
