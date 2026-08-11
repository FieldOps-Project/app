import {
  create as createAxiosInstance,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { domainError, fail, ok, type DomainError, type Result } from '@/domain/result';

const REQUEST_TIMEOUT_MS = 15_000;

/** Session token interceptors are added here in EP-02. */
export const httpClient: AxiosInstance = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

export interface HttpRequest extends Omit<AxiosRequestConfig, 'url'> {
  path: string;
}

/**
 * Returns a `Result` instead of throwing: network loss, timeout and server
 * errors are expected in field use, and the caller decides between showing a
 * message, queueing for resend or requesting a new sign-in.
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

/** The request body never reaches the error, so no sensitive value is logged. */
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
