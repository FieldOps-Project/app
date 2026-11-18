import { OfflineBanner } from '@/components/offline-banner';
import type { ConnectionState } from '@/domain/connectivity';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockConnection: { current: ConnectionState } = { current: { offline: false, reason: null } };
const mockOwner = { current: 'tech-1' };
const mockPending: { current: { data: number | undefined } } = { current: { data: 0 } };

jest.mock('@/application/connectivity/connectivity-context', () => ({
  useConnectivity: () => mockConnection.current,
}));
jest.mock('@/application/inspections/use-inspections', () => ({
  useOwnerUserId: () => mockOwner.current,
  usePendingOperationsCount: () => mockPending.current,
}));

beforeEach(() => {
  mockConnection.current = { offline: false, reason: null };
  mockOwner.current = 'tech-1';
  mockPending.current = { data: 0 };
});

describe('OfflineBanner', () => {
  it('shows nothing while online', () => {
    expect(render(<OfflineBanner />).toJSON()).toBeNull();
  });

  it('says it is offline in words, and that working goes on', () => {
    mockConnection.current = { offline: true, reason: 'no-network' };

    const text = renderedText(render(<OfflineBanner />));

    expect(text).toContain('Sem conexão com a internet.');
    expect(text).toContain('Você pode continuar');
    expect(text).toContain('enviado quando a conexão voltar');
  });

  it('tells a server that does not answer apart from a missing network', () => {
    mockConnection.current = { offline: true, reason: 'server-unreachable' };

    expect(renderedText(render(<OfflineBanner />))).toContain('Sem acesso ao servidor.');
  });

  it('adds how many records wait to be sent (RN-071)', () => {
    mockConnection.current = { offline: true, reason: 'no-network' };
    mockPending.current = { data: 3 };

    expect(renderedText(render(<OfflineBanner />))).toContain('3 registros aguardando envio.');
  });

  it('leaves the count out when nobody is signed in', () => {
    mockConnection.current = { offline: true, reason: 'no-network' };
    mockOwner.current = '';
    mockPending.current = { data: 3 };

    expect(renderedText(render(<OfflineBanner />))).not.toContain('aguardando envio');
  });
});
