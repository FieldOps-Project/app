import {
  create as createAxiosInstance,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { domainError, fail, ok, type DomainError, type Result } from '@/domain/result';

/** Maximum time in milliseconds to wait for a response before aborting. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Shared axios instance pointing at the configured API.
 *
 * Interceptors for the session token are added in EP-02.
 */
export const httpClient: AxiosInstance = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

export interface HttpRequest extends Omit<AxiosRequestConfig, 'url'> {
  /** Path appended to the configured base URL. */
  path: string;
}

/**
 * Performs an HTTP request and returns a `Result` instead of throwing.
 *
 * Network loss, timeout and server error responses are expected conditions in
 * field use, so the caller decides between showing a message, queueing for
 * resend or requesting a new sign-in.
 *
 * @param options Request path plus any axios configuration.
 * @returns The parsed response body, or a `DomainError` describing the failure.
 */
export async function request<TResponse>(
  options: HttpRequest
): Promise<Result<TResponse, DomainError>> {
  const { path, ...config } = options;

  try {
    const response = await httpClient.request<TResponse>({ ...config, url: path });
    return ok(response.data);
  } catch (cause) {
    return fail(toDomainError(cause));
  }
}

/**
 * Maps an axios failure to a `DomainError`.
 *
 * The request body is never copied into the error, so no sensitive value
 * reaches a log through this path.
 */
function toDomainError(cause: unknown): DomainError {
  if (!isAxiosError(cause)) {
    return domainError('unknown', 'Falha inesperada ao consultar a API.', cause);
  }

  const status = cause.response?.status;

  if (status === undefined) {
    return domainError(
      'offline',
      'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.',
      cause
    );
  }

  if (status === 401 || status === 403) {
    return domainError('unauthorized', 'Sessão inválida ou sem permissão para esta ação.', cause);
  }

  if (status === 404) {
    return domainError('not-found', 'Registro não encontrado no servidor.', cause);
  }

  if (status === 400 || status === 422) {
    return domainError('validation', 'O servidor recusou os dados enviados.', cause);
  }

  return domainError('server', `O servidor respondeu com erro ${status}.`, cause);
}
