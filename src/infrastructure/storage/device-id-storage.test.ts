import * as SecureStore from 'expo-secure-store';

type Storage = typeof import('@/infrastructure/storage/device-id-storage');

const mockVault = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockVault.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockVault.set(key, value);
  }),
}));
jest.mock('@/infrastructure/ids', () => {
  let counter = 0;
  return { newId: () => `device-${(counter += 1)}` };
});

function openStorage(): Storage {
  let loaded: Storage | undefined;
  jest.isolateModules(() => {
    loaded = jest.requireActual<Storage>('@/infrastructure/storage/device-id-storage');
  });
  if (loaded === undefined) {
    throw new Error('O armazenamento não carregou.');
  }
  return loaded;
}

beforeEach(() => {
  mockVault.clear();
  jest.clearAllMocks();
});

describe('getDeviceId', () => {
  it('creates the identifier once and keeps it in secure storage', async () => {
    const storage = openStorage();

    const first = await storage.getDeviceId();
    const second = await storage.getDeviceId();

    expect(second).toBe(first);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('fieldops.device-id', first);
  });

  it('gives the same identifier after the app restarts', async () => {
    const before = await openStorage().getDeviceId();

    const after = await openStorage().getDeviceId();

    expect(after).toBe(before);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('tries again after the storage failed, instead of caching the failure', async () => {
    const storage = openStorage();
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('keychain locked'));

    await expect(storage.getDeviceId()).rejects.toThrow('keychain locked');

    await expect(storage.getDeviceId()).resolves.toMatch(/^device-/);
  });
});
