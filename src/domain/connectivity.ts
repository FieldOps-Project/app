export interface NetworkSnapshot {
  readonly isConnected: boolean | null;
  readonly isInternetReachable: boolean | null;
}

export type NetworkStatus = 'online' | 'offline';

export type OfflineReason = 'no-network' | 'server-unreachable';

export interface ConnectionState {
  readonly offline: boolean;
  readonly reason: OfflineReason | null;
}

export const RECONNECT_STABLE_MS = 3000;

export function toNetworkStatus(snapshot: NetworkSnapshot): NetworkStatus {
  return snapshot.isConnected === false || snapshot.isInternetReachable === false
    ? 'offline'
    : 'online';
}

export function toConnectionState(network: NetworkStatus, apiReachable: boolean): ConnectionState {
  if (network === 'offline') {
    return { offline: true, reason: 'no-network' };
  }
  if (!apiReachable) {
    return { offline: true, reason: 'server-unreachable' };
  }
  return { offline: false, reason: null };
}
