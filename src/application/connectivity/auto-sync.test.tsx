import { act } from 'react';

import { AutoSync } from '@/application/connectivity/auto-sync';
import { ENQUEUE_SYNC_DELAY_MS, RECONNECT_STABLE_MS, SERVER_RETRY_MS } from '@/domain/connectivity';
import { render } from '@/testing/render';

const mockConnection: { offline: boolean; reason: 'no-network' | 'server-unreachable' | null } = {
  offline: false,
  reason: null,
};
const mockOwner = { current: 'tech-1' };
const mockMutate = jest.fn();
const mockPendingCount = { current: 0 };
const mockSyncing = { current: false };

jest.mock('@/application/connectivity/connectivity-context', () => ({
  useConnectivity: () => mockConnection,
}));
jest.mock('@/application/inspections/use-inspections', () => ({
  useOwnerUserId: () => mockOwner.current,
  usePendingOperationsCount: () => ({ data: mockPendingCount.current }),
}));
jest.mock('@/application/sync/use-synchronization', () => ({
  useSynchronize: () => ({ mutate: mockMutate, isPending: mockSyncing.current }),
}));

function setOffline(
  offline: boolean,
  renderer: ReturnType<typeof render>,
  reason: 'no-network' | 'server-unreachable' = 'no-network'
) {
  mockConnection.offline = offline;
  mockConnection.reason = offline ? reason : null;
  act(() => renderer.update(<AutoSync />));
}

function setPending(count: number, renderer: ReturnType<typeof render>) {
  mockPendingCount.current = count;
  act(() => renderer.update(<AutoSync />));
}

function setSyncing(syncing: boolean, renderer: ReturnType<typeof render>) {
  mockSyncing.current = syncing;
  act(() => renderer.update(<AutoSync />));
}

function wait(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockConnection.offline = false;
  mockConnection.reason = null;
  mockOwner.current = 'tech-1';
  mockPendingCount.current = 0;
  mockSyncing.current = false;
});

afterEach(() => jest.useRealTimers());

describe('AutoSync', () => {
  it('does not synchronize just because the app opened online', () => {
    render(<AutoSync />);

    wait(RECONNECT_STABLE_MS * 2);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('synchronizes once the connection has been back long enough, and only once', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer);

    setOffline(false, renderer);
    wait(RECONNECT_STABLE_MS - 1);
    expect(mockMutate).not.toHaveBeenCalled();

    wait(1);
    expect(mockMutate).toHaveBeenCalledTimes(1);

    wait(RECONNECT_STABLE_MS * 3);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('waits out a flapping connection instead of synchronizing on every blink', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer);

    for (let blink = 0; blink < 5; blink += 1) {
      setOffline(false, renderer);
      wait(RECONNECT_STABLE_MS - 500);
      setOffline(true, renderer);
    }
    expect(mockMutate).not.toHaveBeenCalled();

    setOffline(false, renderer);
    wait(RECONNECT_STABLE_MS);
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when nobody is signed in', () => {
    mockOwner.current = '';
    const renderer = render(<AutoSync />);
    setOffline(true, renderer);

    setOffline(false, renderer);
    wait(RECONNECT_STABLE_MS * 2);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('forgets a loss of network when the person signs out, so the next sign-in does not sync', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer);
    mockOwner.current = '';
    act(() => renderer.update(<AutoSync />));

    mockOwner.current = 'tech-2';
    setOffline(false, renderer);
    wait(RECONNECT_STABLE_MS * 2);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not repeat a synchronization that the recovery of the server already made', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer, 'server-unreachable');

    setOffline(false, renderer);
    wait(RECONNECT_STABLE_MS * 2);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('keeps probing an unreachable server until it answers, and stops after that', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer, 'server-unreachable');

    wait(SERVER_RETRY_MS * 3);
    expect(mockMutate).toHaveBeenCalledTimes(3);

    setOffline(false, renderer);
    wait(SERVER_RETRY_MS * 3);
    expect(mockMutate).toHaveBeenCalledTimes(3);
  });

  it('does not probe the server while there is no network at all', () => {
    const renderer = render(<AutoSync />);
    setOffline(true, renderer, 'no-network');

    wait(SERVER_RETRY_MS * 3);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not probe the server when nobody is signed in', () => {
    mockOwner.current = '';
    const renderer = render(<AutoSync />);
    setOffline(true, renderer, 'server-unreachable');

    wait(SERVER_RETRY_MS * 3);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  describe('when something new is queued while online', () => {
    it('synchronizes after the delay, and only once', () => {
      const renderer = render(<AutoSync />);

      setPending(1, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS - 1);
      expect(mockMutate).not.toHaveBeenCalled();

      wait(1);
      expect(mockMutate).toHaveBeenCalledTimes(1);

      wait(ENQUEUE_SYNC_DELAY_MS * 3);
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('groups a burst of photos into one synchronization', () => {
      const renderer = render(<AutoSync />);

      setPending(1, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS - 500);
      setPending(2, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS - 500);
      setPending(3, renderer);
      expect(mockMutate).not.toHaveBeenCalled();

      wait(ENQUEUE_SYNC_DELAY_MS);
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('does not synchronize when the queue only shrinks', () => {
      mockPendingCount.current = 3;
      const renderer = render(<AutoSync />);

      setPending(1, renderer);
      setPending(0, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS * 2);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('does not synchronize just because the app opened with operations already queued', () => {
      mockPendingCount.current = 4;
      render(<AutoSync />);

      wait(ENQUEUE_SYNC_DELAY_MS * 2);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('does not retry on its own when a synchronization leaves the queue as it was', () => {
      const renderer = render(<AutoSync />);
      setPending(2, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS);
      expect(mockMutate).toHaveBeenCalledTimes(1);

      setPending(2, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS * 3);

      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('waits for a synchronization in progress before sending what was queued meanwhile', () => {
      const renderer = render(<AutoSync />);
      setSyncing(true, renderer);

      setPending(1, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS * 3);
      expect(mockMutate).not.toHaveBeenCalled();

      setSyncing(false, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS);
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('leaves it to the reconnection when there is no network, without synchronizing twice', () => {
      const renderer = render(<AutoSync />);
      setOffline(true, renderer);

      setPending(1, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS * 3);
      expect(mockMutate).not.toHaveBeenCalled();

      setOffline(false, renderer);
      wait(RECONNECT_STABLE_MS + ENQUEUE_SYNC_DELAY_MS * 3);

      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    it('does nothing when nobody is signed in', () => {
      mockOwner.current = '';
      const renderer = render(<AutoSync />);

      setPending(1, renderer);
      wait(ENQUEUE_SYNC_DELAY_MS * 2);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});
