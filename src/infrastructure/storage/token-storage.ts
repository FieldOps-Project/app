import * as SecureStore from 'expo-secure-store';

const TOKENS_KEY = 'fieldops.tokens';

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
}

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
