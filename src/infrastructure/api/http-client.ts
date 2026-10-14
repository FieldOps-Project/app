import {
  create as createAxiosInstance,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { fail, ok, type Result } from '@/domain/result';
import { parseApiErrorBody } from '@/infrastructure/api/api-error';
import { AUTH_PATHS } from '@/infrastructure/api/auth-paths';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import { RefreshUnavailableError, refreshSession } from '@/infrastructure/api/token-refresh';
import { readTokens } from '@/infrastructure/storage/token-storage';

/**
 * A request must never hang the screen. On an unstable field network a request
 * with no deadline stays pending forever and the UI is stuck loading; the
 * timeout turns that into a `network` failure the caller can act on. It is
 * explicit and mandatory for exactly this reason.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The HTTP client every API call goes through. The session renewal is the one
 * exception and uses its own `refreshClient`, which must bypass these
 * interceptors.
 */
export const httpClient: AxiosInstance = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

/**
 * Attaches the stored access token to every request that has one.
 *
 * The token never lives in app state, only in secure storage (RN-007), so it
 * is read fresh on each request rather than cached in a variable that could
 * drift after sign-out. Expiry is handled by the response interceptor below.
 */
httpClient.interceptors.request.use(async (config) => {
  const tokens = await readTokens();
  if (tokens !== null) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

/**
 * A 401 from these is an answer, not an expired token: bad credentials on
 * login, a refused refresh token on refresh. Renewing on those would loop or
 * hide the real failure.
 */
const SESSION_ENDPOINTS: readonly string[] = Object.values(AUTH_PATHS);

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  /** Set on the repeated request so a second 401 is returned, never renewed again. */
  retriedAfterRefresh?: boolean;
}

/**
 * Renews the session on a 401 and repeats the request once (card #8).
 *
 * - Concurrent 401s share a single refresh (see `refreshSession`).
 * - A request that carried an older token than the one now stored was already
 *   overtaken by another refresh, so it is repeated without refreshing again —
 *   with rotating tokens a second refresh would be refused.
 * - If the server refuses the refresh, the original 401 is returned as-is and
 *   the session listeners have already been told.
 * - If the refresh could not reach the server, the failure is `network`/`server`
 *   and the session is kept: no signal must never mean signed out.
 * - The repeat happens at most once, so a request that keeps failing cannot loop.
 */
httpClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError(error) || error.response?.status !== 401 || error.config === undefined) {
    throw error;
  }

  const config: RetriableRequestConfig = error.config;
  if (config.retriedAfterRefresh === true || isSessionEndpoint(config.url)) {
    throw error;
  }

  const stored = await readTokens();
  if (stored === null) {
    throw error;
  }

  const wasOvertaken = config.headers.get('Authorization') !== `Bearer ${stored.accessToken}`;
  if (!wasOvertaken) {
    const outcome = await refreshSession();
    if (outcome.kind === 'rejected') {
      throw error;
    }
    if (outcome.kind === 'unavailable') {
      throw new RefreshUnavailableError(outcome.failure);
    }
  }

  config.retriedAfterRefresh = true;
  return httpClient.request(config);
});

function isSessionEndpoint(url: string | undefined): boolean {
  return url !== undefined && SESSION_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
}

export interface HttpRequest extends Omit<AxiosRequestConfig, 'url'> {
  path: string;
}

/**
 * Performs a request and returns a `Result` instead of throwing.
 *
 * Network loss, timeout and server faults are all expected in field use, so the
 * caller — not a try/catch buried in a screen — decides between showing a
 * message, queueing for resend or asking for a new sign-in.
 */
export async function request<TResponse>(
  options: HttpRequest
): Promise<Result<TResponse, ApiFailure>> {
  const { path, ...config } = options;

  try {
    const response = await httpClient.request<TResponse>({ ...config, url: path });
    return ok(response.data);
  } catch (cause) {
    return fail(toApiFailure(cause));
  }
}

/**
 * Translates a transport-level error into the app's failure taxonomy.
 *
 * A missing response means the round-trip never completed — offline, DNS
 * failure or the timeout above — and all three map to `network`, the failure
 * that is never shown. 422 is the canonical business status (12.2); a 400 is
 * accepted as business only when it carries the same envelope, since some
 * validations surface that way, and a rejection without the envelope, like any
 * other unmapped status, is a `server` fault the user cannot resolve.
 *
 * Nothing from the request — headers, body, bearer token — is ever copied onto
 * the failure: only the server's own error envelope and the HTTP status shape
 * the result, which keeps credentials out of every failure value and out of any
 * log (RN-007).
 */
function toApiFailure(cause: unknown): ApiFailure {
  if (cause instanceof RefreshUnavailableError) {
    return { kind: cause.failure };
  }

  if (!isAxiosError(cause) || cause.response === undefined) {
    return { kind: 'network' };
  }

  const { status, data } = cause.response;

  switch (status) {
    case 401:
      return { kind: 'unauthorized' };
    case 403:
      return { kind: 'forbidden' };
    case 404:
      return { kind: 'notFound' };
    case 409: {
      const body = parseApiErrorBody(data);
      return { kind: 'conflict', code: body?.code ?? 'CONFLICT' };
    }
    case 400:
    case 422: {
      const body = parseApiErrorBody(data);
      if (body === null) {
        return { kind: 'server' };
      }
      return {
        kind: 'business',
        code: body.code,
        message: body.message,
        ...(body.fieldErrors ? { fieldErrors: body.fieldErrors } : {}),
      };
    }
    default:
      return { kind: 'server' };
  }
}
