import { act } from 'react';

import {
  ConnectivityProvider,
  useConnectivity,
  type ConnectivityValue,
} from '@/application/connectivity/connectivity-context';
import type { NetworkSnapshot } from '@/domain/connectivity';
import { render } from '@/testing/render';

let emit: (snapshot: NetworkSnapshot) => void = () => undefined;
const mockUnsubscribe = jest.fn();

jest.mock('@/infrastructure/network/network-status', () => ({
  subscribeToNetwork: (listener: (snapshot: NetworkSnapshot) => void) => {
    emit = listener;
    return mockUnsubscribe;
  },
}));

const ONLINE = { isConnected: true, isInternetReachable: true };
const OFFLINE = { isConnected: false, isInternetReachable: false };

let current: ConnectivityValue;

function Probe({ onRender }: { onRender: (value: ConnectivityValue) => void }) {
  onRender(useConnectivity());
  return null;
}

function mount() {
  return render(
    <ConnectivityProvider>
      <Probe onRender={(latest) => (current = latest)} />
    </ConnectivityProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('ConnectivityProvider', () => {
  it('starts online, so the app never flashes an offline notice on launch', () => {
    mount();

    expect(current).toMatchObject({ offline: false, reason: null });
  });

  it('detects the loss and the return of the connection', () => {
    mount();

    act(() => emit(OFFLINE));
    expect(current).toMatchObject({ offline: true, reason: 'no-network' });

    act(() => emit(ONLINE));
    expect(current).toMatchObject({ offline: false, reason: null });
  });

  it('treats an unreachable API as offline although the network says online', () => {
    mount();
    act(() => emit(ONLINE));

    act(() => current.reportApiReachable(false));

    expect(current).toMatchObject({ offline: true, reason: 'server-unreachable' });
  });

  it('clears the API signal when the API answers again', () => {
    mount();
    act(() => current.reportApiReachable(false));

    act(() => current.reportApiReachable(true));

    expect(current.offline).toBe(false);
  });

  it('gives the API a fresh chance when the network changes', () => {
    mount();
    act(() => current.reportApiReachable(false));

    act(() => emit(ONLINE));

    expect(current.offline).toBe(false);
  });

  it('stops listening when it unmounts', () => {
    const renderer = mount();

    act(() => renderer.unmount());

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
