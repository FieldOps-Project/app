import type { Result } from '@/domain/result';
import type { Session, SessionRole } from '@/domain/session';
import { fail, ok } from '@/domain/result';
import type { ApiFailure } from '@/infrastructure/api/api-failure';
import type { components } from '@/infrastructure/api/generated/schema';
import { request } from '@/infrastructure/api/http-client';
import type { AuthTokens } from '@/infrastructure/storage/token-storage';

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

/**
 * Turns the login response into the app's own types, failing closed on any
 * field the contract marks optional but the login flow cannot work without.
 * The API is trusted for shape (12.2) — this only guards the fields whose
 * absence would otherwise surface as a confusing crash deeper in the app.
 */
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

/**
 * Authenticates against `POST /api/v1/auth/login` (document 12.2, card #6).
 *
 * Token refresh and the `Authorization` retry loop are card #8's scope; this
 * only starts the session.
 */
export async function login(
  credentials: LoginCredentials
): Promise<Result<AuthSession, ApiFailure>> {
  const result = await request<LoginResponseBody>({
    method: 'POST',
    path: '/api/v1/auth/login',
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
