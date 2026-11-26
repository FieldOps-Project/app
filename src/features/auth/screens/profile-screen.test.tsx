import { ProfileScreen } from '@/features/auth/screens/profile-screen';
import { act } from 'react';

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
const mockPending: { current: { data: number | undefined } } = { current: { data: 0 } };

jest.mock('@/application/inspections/use-inspections', () => ({
  usePendingOperationsCount: () => mockPending.current,
}));
const mockRole: { current: string } = { current: 'TECHNICIAN' };

jest.mock('@/application/session/session-context', () => ({
  useSession: () => ({
    session: { name: 'Ana Souza', email: 'ana@fieldops.com', role: mockRole.current },
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

describe('ProfileScreen role and sign-out', () => {
  beforeEach(() => {
    mockDevice.current = { data: 'c3f1-device', isError: false };
    mockPending.current = { data: 0 };
    mockRole.current = 'TECHNICIAN';
  });

  it.each([
    ['TECHNICIAN', 'Técnico · executa inspeções em campo'],
    ['SUPERVISOR', 'Supervisor'],
    ['ADMIN', 'Administrador'],
  ])('describes the %s role without promising features the app lacks', (role, label) => {
    mockRole.current = role;

    const text = renderedText(render(<ProfileScreen />));

    expect(text).toContain(label);
    expect(text).not.toContain('pode revisar');
  });

  function openConfirmation() {
    const screen = render(<ProfileScreen />);
    const leave = screen.root.findAll((node) => node.props.label === 'Sair')[0];
    act(() => leave?.props.onPress());
    return renderedText(screen);
  }

  it('warns how many records have not reached the server before signing out', () => {
    mockPending.current = { data: 3 };

    expect(openConfirmation()).toContain('3 registros ainda não foram enviados');
  });

  it('does not alarm when everything was sent', () => {
    expect(openConfirmation()).not.toContain('ainda não foi');
  });
});
