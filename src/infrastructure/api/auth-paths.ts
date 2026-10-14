/**
 * The endpoints that start, renew or end a session. Kept in one place because
 * the HTTP client must recognise them: a 401 from any of these is an answer,
 * never an expired token to renew.
 */
export const AUTH_PATHS = {
  login: '/api/v1/auth/login',
  refresh: '/api/v1/auth/refresh',
  logout: '/api/v1/auth/logout',
} as const;
