import { RefreshControl } from 'react-native';

import { HomeScreen } from '@/features/home/screens/home-screen';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/config/env', () => ({ env: { appEnv: 'production' }, isProduction: true }));
jest.mock('@/application/session/session-context', () => ({
  useSession: () => ({ session: { name: 'Ana Souza', role: 'TECHNICIAN' } }),
}));
jest.mock('@/features/synchronization/components/download-status', () => ({
  DownloadStatus: () => null,
}));
jest.mock('@/features/synchronization/components/sync-now-button', () => ({
  SyncNowButton: () => null,
}));

const mockRefresh = jest.fn();
const mockRefreshing = { current: false };

jest.mock('@/application/inspections/use-home-overview', () => ({
  useHomeOverview: () => ({
    state: 'ready',
    pendingOperations: 0,
    day: { today: 2, overdue: 0, inProgress: 1, withUnsentWork: 0 },
  }),
  useHomeRefresh: () => ({ refreshing: mockRefreshing.current, refresh: mockRefresh }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshing.current = false;
});

describe('HomeScreen pull to refresh', () => {
  it('refreshes the metrics when the person pulls the screen down', () => {
    const renderer = render(<HomeScreen />);

    const control = renderer.root.findByType(RefreshControl);
    control.props.onRefresh();

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the refreshing indicator while the update runs', () => {
    mockRefreshing.current = true;

    const renderer = render(<HomeScreen />);

    expect(renderer.root.findByType(RefreshControl).props.refreshing).toBe(true);
  });

  it('tells the person that pulling down updates the screen', () => {
    expect(renderedText(render(<HomeScreen />))).toContain('Puxe para baixo para atualizar.');
  });
});
