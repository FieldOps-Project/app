import * as SecureStore from 'expo-secure-store';

import { readSession } from '@/infrastructure/storage/session-storage';
import { readTokens } from '@/infrastructure/storage/token-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const stored = (raw: string | null) => jest.mocked(SecureStore.getItemAsync).mockResolvedValue(raw);

describe('readTokens', () => {
  it('returns the tokens that were stored', async () => {
    stored(JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: 10 }));

    expect(await readTokens()).toEqual({ accessToken: 'a', refreshToken: 'r', expiresAt: 10 });
  });

  it.each([
    ['nothing', null],
    ['text that is not JSON', 'not json'],
    ['JSON of the wrong shape', JSON.stringify({ accessToken: 'a' })],
    ['empty tokens', JSON.stringify({ accessToken: '', refreshToken: '', expiresAt: 1 })],
  ])('treats %s as signed out', async (_name, raw) => {
    stored(raw);

    expect(await readTokens()).toBeNull();
  });

  it('treats a secure storage failure as signed out', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('keychain unavailable'));

    expect(await readTokens()).toBeNull();
  });
});

describe('readSession', () => {
  const user = { userId: 'u-1', name: 'Ana', email: 'ana@fieldops.com', role: 'TECHNICIAN' };

  it('returns the session that was stored', async () => {
    stored(JSON.stringify(user));

    expect(await readSession()).toEqual(user);
  });

  it.each([
    ['nothing', null],
    ['text that is not JSON', '{'],
    ['a role the app does not know', JSON.stringify({ ...user, role: 'ROOT' })],
    ['a profile without an id', JSON.stringify({ name: 'Ana' })],
  ])('treats %s as signed out', async (_name, raw) => {
    stored(raw);

    expect(await readSession()).toBeNull();
  });
});
