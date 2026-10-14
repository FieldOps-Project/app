import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

/** What a fake server answers: an HTTP status with a body, or no answer at all. */
export type Reply = { status: number; data?: unknown } | 'network';

/**
 * Builds an axios adapter from a handler, so tests drive the real client —
 * interceptors and all — without opening a socket. Statuses of 400 and above
 * reject the way axios does, and `'network'` rejects with no response, which
 * is what an offline device or a timeout looks like.
 */
export function fakeAdapter(
  handler: (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>
): AxiosAdapter {
  return async (config) => {
    const reply = await handler(config);
    if (reply === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }

    const response: AxiosResponse = {
      data: reply.data ?? null,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
}

export const RENEWED_TOKENS_BODY = {
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
  expiresIn: 900,
};
