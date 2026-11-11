import type { Result } from '@/domain/result';
import type { Session, SessionRole } from '@/domain/session';
import { fail, ok } from '@/domain/result';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import type { components } from '@/infrastructure/api/generated/schema';
import { request } from '@/infrastructure/api/http-client';
import type { AuthTokens } from '@/infrastructure/storage/token-storage';
import { AUTH_PATHS } from '@/infrastructure/api/auth-paths';

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface AuthSession {
  readonly tokens: AuthTokens;
  readonly user: Session;
}

type LoginResponseBody = components['schemas']['LoginResponse'];

const ROLES: readonly SessionRole[] = ['ADMIN', 'SUPERVISOR', 'TECHNICIAN', 'CLIENT_VIEWER'];

function isSessionRole(value: string | undefined): value is SessionRole {
  return value !== undefined && (ROLES as readonly string[]).includes(value);
}

function toAuthSession(body: LoginResponseBody): AuthSession | null {
  const { accessToken, refreshToken, expiresIn, user } = body;
  if (
    accessToken === undefined ||
    refreshToken === undefined ||
    expiresIn === undefined ||
    user?.id === undefined ||
    user.name === undefined ||
    user.email === undefined ||
    !isSessionRole(user.role)
  ) {
    return null;
  }

  return {
    tokens: { accessToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 },
    user: { userId: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function login(
  credentials: LoginCredentials
): Promise<Result<AuthSession, ApiFailure>> {
  const result = await request<LoginResponseBody>({
    method: 'POST',
    path: AUTH_PATHS.login,
    data: credentials,
  });

  if (!result.ok) {
    return result;
  }

  const session = toAuthSession(result.value);
  if (session === null) {
    return fail({ kind: 'server' });
  }

  return ok(session);
}

export function logout(refreshToken: string): Promise<Result<void, ApiFailure>> {
  return request<void>({
    method: 'POST',
    path: AUTH_PATHS.logout,
    data: { refreshToken },
  });
}
