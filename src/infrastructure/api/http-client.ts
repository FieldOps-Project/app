import {
  create as createAxiosInstance,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { fail, ok, type Result } from '@/domain/result';
import { parseApiErrorBody } from '@/infrastructure/api/api-error';
import type { ApiFailure } from '@/infrastructure/api/api-failure';

/**
 * A request must never hang the screen. On an unstable field network a request
 * with no deadline stays pending forever and the UI is stuck loading; the
 * timeout turns that into a `network` failure the caller can act on. It is
 * explicit and mandatory for exactly this reason.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/** The single HTTP client for the whole app. Auth interceptors arrive in EP-02. */
export const httpClient: AxiosInstance = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

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
 * Nothing from the request — headers, body, bearer token — is ever copied onto
 * the failure. Only the server's own error envelope (safe business data) and
 * the HTTP status shape the result, which keeps credentials out of every
 * failure value and, in turn, out of any log (RN-007).
 */
function toApiFailure(cause: unknown): ApiFailure {
  // No `response` means the round-trip never completed: offline, DNS failure or
  // the timeout above. All three are `network` — the failure that is never shown.
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
    // 422 is the canonical business status (12.2); a 400 is accepted only when
    // it carries the same envelope, since some validations surface that way.
    case 400:
    case 422: {
      const body = parseApiErrorBody(data);
      if (body === null) {
        // A rejection without the agreed envelope is a contract break, not a
        // business rule the user can act on: treat it as a server fault.
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
      // 5xx and any unmapped status: a fault the user cannot resolve.
      return { kind: 'server' };
  }
}
