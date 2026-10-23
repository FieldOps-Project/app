import { randomUUID } from 'expo-crypto';

/**
 * Identifiers are generated on the device (document 10.2), so a record keeps
 * the same id from the moment it is saved offline to the moment the server
 * confirms it, and a resend updates instead of duplicating (RN-068).
 */
export function newId(): string {
  return randomUUID();
}
