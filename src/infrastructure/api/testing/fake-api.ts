import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

export type Reply = { status: number; data?: unknown } | 'network' | 'timeout';

export function fakeAdapter(
  handler: (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>
): AxiosAdapter {
  return async (config) => {
    const reply = await handler(config);
    if (reply === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    if (reply === 'timeout') {
      throw new AxiosError('timeout of 15000ms exceeded', AxiosError.ECONNABORTED, config);
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
