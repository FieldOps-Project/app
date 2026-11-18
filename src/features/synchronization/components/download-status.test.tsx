import { Button } from '@/design-system/components/button';
import { DownloadStatus } from '@/features/synchronization/components/download-status';
import type { ApiFailure } from '@/infrastructure/api';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));

interface DownloadState {
  isFetching: boolean;
  error: ApiFailure | null;
}

const mockDownload: { current: DownloadState } = {
  current: { isFetching: false, error: null },
};
const mockRefetch = jest.fn();

jest.mock('@/application/sync/use-synchronization', () => ({
  useInspectionsDownload: () => ({ ...mockDownload.current, refetch: mockRefetch }),
}));

function draw(state: Partial<DownloadState>) {
  mockDownload.current = { isFetching: false, error: null, ...state };
  return render(<DownloadStatus />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DownloadStatus', () => {
  it('shows nothing when the list is up to date', () => {
    expect(draw({}).toJSON()).toBeNull();
  });

  it('announces the update in progress', () => {
    expect(renderedText(draw({ isFetching: true }))).toContain('Atualizando inspeções...');
  });

  it('keeps the saved inspections in sight when the device is offline', () => {
    expect(renderedText(draw({ error: { kind: 'network' } }))).toContain(
      'Sem conexão. Mostrando as inspeções salvas neste aparelho.'
    );
  });

  it('explains a failure in business language and offers another try', () => {
    const renderer = draw({ error: { kind: 'server' } });
    const text = renderedText(renderer);

    expect(text).toContain('Não foi possível atualizar. Mostrando as inspeções salvas');
    expect(text).toContain('O servidor está com problemas no momento');

    renderer.root.findByType(Button).props.onPress();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
