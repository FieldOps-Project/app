import { ProfileScreen } from '@/features/auth/screens/profile-screen';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({
  env: { apiUrl: 'http://api.test', appEnv: 'integration' },
  ENVIRONMENT_LABELS: { integration: 'Integração' },
}));
jest.mock('@/config/app-info', () => ({ appVersionLabel: '1.0.0 (7)' }));

const mockDevice: { current: { data?: string; isError: boolean } } = {
  current: { data: 'c3f1-device', isError: false },
};

jest.mock('@/application/device/use-device-id', () => ({
  useDeviceId: () => mockDevice.current,
}));
jest.mock('@/application/session/session-context', () => ({
  useSession: () => ({
    session: { name: 'Ana Souza', email: 'ana@fieldops.com', role: 'TECHNICIAN' },
    signOut: jest.fn(),
  }),
}));

describe('ProfileScreen support information', () => {
  it('shows the version with its build, the environment and the device identifier', () => {
    mockDevice.current = { data: 'c3f1-device', isError: false };

    const text = renderedText(render(<ProfileScreen />));

    expect(text).toContain('Versão 1.0.0 (7)');
    expect(text).toContain('Ambiente: Integração');
    expect(text).toContain('c3f1-device');
  });

  it('says so when the identifier cannot be read, instead of staying blank', () => {
    mockDevice.current = { isError: true };

    expect(renderedText(render(<ProfileScreen />))).toContain(
      'Não foi possível ler o identificador'
    );
  });

  it('shows a reading notice while the identifier loads', () => {
    mockDevice.current = { isError: false };

    expect(renderedText(render(<ProfileScreen />))).toContain('Lendo...');
  });
});
