import * as SecureStore from 'expo-secure-store';

const TOKENS_KEY = 'fieldops.tokens';

/** The pair of JWTs the API issues on login, plus when the access token expires. */
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Epoch milliseconds. Computed locally from the login response's `expiresIn`. */
  readonly expiresAt: number;
}

/**
 * Reads the stored tokens.
 *
 * An unreadable or corrupted entry resolves to `null`, same as
 * `session-storage`, so a broken token store is treated as signed out rather
 * than crashing the app.
 */
export async function readTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKENS_KEY);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}
