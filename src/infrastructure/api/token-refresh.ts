import { create as createAxiosInstance, isAxiosError } from 'axios';

import { env } from '@/config/env';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import { AUTH_PATHS } from '@/infrastructure/api/auth-paths';
import { clearTokens, readTokens, writeTokens } from '@/infrastructure/storage/token-storage';
import type { AuthTokens } from '@/infrastructure/storage/token-storage';

const REFRESH_TIMEOUT_MS = 15_000;

export const refreshClient = createAxiosInstance({
  baseURL: env.apiUrl,
  timeout: REFRESH_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

export type UnreachableFailure = Extract<ApiFailure['kind'], 'network' | 'server'>;

export type RefreshOutcome =
  | { kind: 'refreshed' }
  | { kind: 'rejected' }
  | { kind: 'unavailable'; failure: UnreachableFailure };

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

export function onSessionRejected(listener: SessionRejectedListener): () => void {
  sessionRejectedListeners.add(listener);
  return () => {
    sessionRejectedListeners.delete(listener);
  };
}

let inFlight: Promise<RefreshOutcome> | null = null;

export function refreshSession(): Promise<RefreshOutcome> {
  inFlight ??= performRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

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

function toUnreachableFailure(cause: unknown): UnreachableFailure {
  return isAxiosError(cause) && cause.response === undefined ? 'network' : 'server';
}

function revokeQuietly(refreshToken: string): void {
  refreshClient.post(AUTH_PATHS.logout, { refreshToken }).catch(() => undefined);
}

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
