import * as SecureStore from 'expo-secure-store';

import type { Session } from '@/domain/session';

const SESSION_KEY = 'fieldops.session';

/**
 * Persists the session in the device secure storage.
 *
 * The session is kept in `expo-secure-store`, backed by the Android Keystore
 * and the iOS Keychain, and never in AsyncStorage. This module is the single
 * source of the session: EP-02 replaces its contents with the real sign-in
 * response without any screen or route changing.
 *
 * An unreadable or corrupted entry resolves to `null`, which the route guard
 * treats as signed out and sends to the login screen. The stored value is not
 * logged, so a failure never exposes its contents.
 *
 * @returns The stored session, or `null` when there is none.
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

/** Stores the session, replacing any previous one. */
export async function writeSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

/** Removes the stored session. */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
