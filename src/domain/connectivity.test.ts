import { toConnectionState, toNetworkStatus } from '@/domain/connectivity';

describe('toNetworkStatus', () => {
  it.each([
    [{ isConnected: false, isInternetReachable: false }, 'offline'],
    [{ isConnected: false, isInternetReachable: null }, 'offline'],
    [{ isConnected: true, isInternetReachable: false }, 'offline'],
    [{ isConnected: true, isInternetReachable: true }, 'online'],
  ] as const)('reads %j as %s', (snapshot, expected) => {
    expect(toNetworkStatus(snapshot)).toBe(expected);
  });

  it('does not flash offline while the state is still unknown', () => {
    expect(toNetworkStatus({ isConnected: null, isInternetReachable: null })).toBe('online');
    expect(toNetworkStatus({ isConnected: true, isInternetReachable: null })).toBe('online');
  });

  it('treats wi-fi without internet access (a captive portal) as offline', () => {
    expect(toNetworkStatus({ isConnected: true, isInternetReachable: false })).toBe('offline');
  });
});

describe('toConnectionState', () => {
  it('is online only when the network is up and the API answers', () => {
    expect(toConnectionState('online', true)).toEqual({ offline: false, reason: null });
  });

  it('says there is no network first', () => {
    expect(toConnectionState('offline', true)).toEqual({ offline: true, reason: 'no-network' });
    expect(toConnectionState('offline', false)).toEqual({ offline: true, reason: 'no-network' });
  });

  it('treats a failing API as offline even when the network reports a connection', () => {
    expect(toConnectionState('online', false)).toEqual({
      offline: true,
      reason: 'server-unreachable',
    });
  });
});
