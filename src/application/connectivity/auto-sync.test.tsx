import { act } from 'react';

import { AutoSync } from '@/application/connectivity/auto-sync';
import { RECONNECT_STABLE_MS } from '@/domain/connectivity';
import { render } from '@/testing/render';

const mockConnection = { offline: false };
const mockOwner = { current: 'tech-1' };
const mockMutate = jest.fn();

jest.mock('@/application/connectivity/connectivity-context', () => ({
  useConnectivity: () => mockConnection,
}));
jest.mock('@/application/inspections/use-inspections', () => ({
  useOwnerUserId: () => mockOwner.current,
}));
jest.mock('@/application/sync/use-synchronization', () => ({
  useSynchronize: () => ({ mutate: mockMutate }),
}));

function setOffline(offline: boolean, renderer: ReturnType<typeof render>) {
  mockConnection.offline = offline;
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
  mockOwner.current = 'tech-1';
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
});
