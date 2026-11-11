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

const REQUEST_TIMEOUT_MS = 15_000;

export const httpClient: AxiosInstance = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

httpClient.interceptors.request.use(async (config) => {
  const tokens = await readTokens();
  if (tokens !== null) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

const SESSION_ENDPOINTS: readonly string[] = Object.values(AUTH_PATHS);

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  retriedAfterRefresh?: boolean;
}

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
