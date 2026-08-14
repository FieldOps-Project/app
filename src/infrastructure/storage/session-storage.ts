import * as SecureStore from 'expo-secure-store';

import type { Session } from '@/domain/session';

const SESSION_KEY = 'fieldops.session';

/**
 * Reads the stored session.
 *
 * An unreadable or corrupted entry resolves to `null`, which the route guard
 * treats as signed out. The stored value is never logged.
 */
export async function readSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
