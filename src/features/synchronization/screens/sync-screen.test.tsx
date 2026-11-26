import type { ReactElement } from 'react';
import { FlatList } from 'react-native';
import { act } from 'react-test-renderer';

import type { InspectionSummary } from '@/domain/inspection';
import { SyncScreen } from '@/features/synchronization/screens/sync-screen';
import type { LastSync } from '@/infrastructure/repositories/inspection-repository';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'local' } }));

const mockLast: { current: { data: LastSync | undefined } } = { current: { data: undefined } };
const mockVisible: { current: unknown[] } = { current: [] };
const mockPush = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/application/inspections/use-inspection-list', () => ({
  useInspectionList: () => ({
    isLoading: false,
    isError: false,
    visible: mockVisible.current,
    reload: jest.fn(),
  }),
}));
jest.mock('@/application/inspections/use-inspections', () => ({
  usePendingOperationsCount: () => ({ data: 2, isError: false }),
  useLastSync: () => mockLast.current,
}));
jest.mock('@/features/synchronization/components/sync-now-button', () => ({
  SyncNowButton: () => null,
}));

const STARTED = '2026-08-12T13:00:00.000Z';

function shown(lastSync: LastSync | undefined): string {
  mockLast.current = { data: lastSync };
  return renderedText(render(<SyncScreen />));
}

describe('SyncScreen last synchronization (RN-072)', () => {
  it('says so when nothing was ever synchronized', () => {
    expect(shown(undefined)).toContain('Nenhuma sincronização neste aparelho ainda.');
  });

  it('gives the date and the result of the last attempt', () => {
    const text = shown({ startedAt: STARTED, result: 'SUCCESS', lastSuccessfulAt: STARTED });

    expect(text).toContain('Última tentativa:');
    expect(text).toContain('tudo sincronizado');
    expect(text).not.toContain('Última sincronização completa');
  });

  it('keeps the last complete synchronization next to a partial or failed attempt', () => {
    const partial = shown({
      startedAt: STARTED,
      result: 'PARTIAL',
      lastSuccessfulAt: '2026-08-11T09:00:00.000Z',
    });
    expect(partial).toContain('o servidor recusou alguns registros');
    expect(partial).toContain('Última sincronização completa:');

    const failed = shown({ startedAt: STARTED, result: 'FAILED', lastSuccessfulAt: null });
    expect(failed).toContain('sem conexão ou servidor indisponível');
    expect(failed).toContain('Nenhuma sincronização completa neste aparelho ainda.');
  });

  it('shows how many records still wait to be sent (RN-071)', () => {
    expect(shown(undefined)).toContain('2 registros aguardando envio');
  });
});

describe('SyncScreen conflicts (card #28)', () => {
  const conflicted: InspectionSummary = {
    id: 'insp-1',
    title: 'Inspeção do gerador',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    scheduledFor: '2026-08-12T13:00:00Z',
    clientName: 'Indústria ABC',
    siteName: 'Fábrica',
    equipmentName: null,
    syncState: 'conflito',
  };

  function renderRow(syncState: InspectionSummary['syncState']) {
    mockVisible.current = [{ inspection: { ...conflicted, syncState }, overdue: false }];
    mockLast.current = { data: undefined };
    const screen = render(<SyncScreen />);
    const list = screen.root.findByType(FlatList);
    const element = list.props.renderItem({ item: mockVisible.current[0] }) as ReactElement;
    return render(element);
  }

  function pressable(row: ReturnType<typeof render>) {
    return [row.root, ...row.root.findAll(() => true)].find(
      (node) =>
        node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
    );
  }

  afterEach(() => {
    mockVisible.current = [];
    mockPush.mockReset();
  });

  it('highlights a conflicted inspection and says the data was preserved', () => {
    const text = renderedText(renderRow('conflito'));

    expect(text).toContain('Alterada no servidor');
    expect(text).toContain('Seus dados foram preservados');
  });

  it('opens the affected inspection from the conflict', () => {
    const row = renderRow('conflito');

    act(() => pressable(row)?.props.onPress());

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/inspections/[inspectionId]',
      params: { inspectionId: 'insp-1' },
    });
  });

  it('keeps a normal inspection as a plain, non-pressable entry', () => {
    const text = renderedText(renderRow('aguardando-envio'));

    expect(text).not.toContain('Alterada no servidor');
    expect(pressable(renderRow('aguardando-envio'))).toBeUndefined();
  });
});
