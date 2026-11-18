import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';

import {
  ConnectivityProvider,
  useConnectivity,
  type ConnectivityValue,
} from '@/application/connectivity/connectivity-context';
import { refreshInspections } from '@/application/sync/refresh-inspections';
import { synchronize } from '@/application/sync/synchronize';
import { useInspectionsDownload, useSynchronize } from '@/application/sync/use-synchronization';
import { fail, ok } from '@/domain/result';
import { render } from '@/testing/render';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', demoInspections: false } }));
jest.mock('@/application/sync/synchronize');
jest.mock('@/application/sync/refresh-inspections');
jest.mock('@/application/inspections/use-inspections', () => ({ useOwnerUserId: () => 'tech-1' }));
jest.mock('@/infrastructure/network/network-status', () => ({
  subscribeToNetwork: () => () => undefined,
}));

const SYNCED = { sent: 0, refused: 0, refresh: { saved: 0, failed: 0 } };

interface Seen {
  connection: ConnectivityValue;
  synchronizeNow: () => void;
}

let seen: Seen;

function Probe({ onRender }: { onRender: (seen: Seen) => void }) {
  const connectivity = useConnectivity();
  const { mutate } = useSynchronize();
  useInspectionsDownload();
  onRender({ connection: connectivity, synchronizeNow: mutate });
  return null;
}

let mounted: ReturnType<typeof render> | null = null;

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mounted = render(
    <QueryClientProvider client={client}>
      <ConnectivityProvider>
        <Probe onRender={(latest) => (seen = latest)} />
      </ConnectivityProvider>
    </QueryClientProvider>
  );
  return mounted;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(async () => {
  const screen = mounted;
  mounted = null;
  await act(async () => screen?.unmount());
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(refreshInspections).mockResolvedValue(ok({ saved: 0, failed: 0 }));
  jest.mocked(synchronize).mockResolvedValue(ok(SYNCED));
});

describe('connectivity as seen by the requests', () => {
  it('flags the server as unreachable when a synchronization fails for lack of network', async () => {
    mount();
    await settle();
    jest.mocked(synchronize).mockResolvedValue(fail({ kind: 'network' }));

    await act(async () => seen.synchronizeNow());

    expect(seen.connection).toMatchObject({ offline: true, reason: 'server-unreachable' });
  });

  it('flags it too when the download of the list fails for lack of network', async () => {
    jest.mocked(refreshInspections).mockResolvedValue(fail({ kind: 'network' }));

    mount();
    await settle();

    expect(seen.connection).toMatchObject({ offline: true, reason: 'server-unreachable' });
  });

  it('is back online as soon as a request gets through', async () => {
    mount();
    await settle();
    jest.mocked(synchronize).mockResolvedValue(fail({ kind: 'network' }));
    await act(async () => seen.synchronizeNow());

    jest.mocked(synchronize).mockResolvedValue(ok(SYNCED));
    await act(async () => seen.synchronizeNow());

    expect(seen.connection.offline).toBe(false);
  });

  it('does not call the server offline for a refusal that proves it answered', async () => {
    mount();
    await settle();
    jest.mocked(synchronize).mockResolvedValue(fail({ kind: 'unauthorized' }));

    await act(async () => seen.synchronizeNow());

    expect(seen.connection.offline).toBe(false);
  });
});
