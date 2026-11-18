import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import type { ApiFailure } from '@/infrastructure/api';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'development' } }));

interface SyncState {
  isPending: boolean;
  isSuccess: boolean;
  data: { sent: number; refused: number } | undefined;
  error: ApiFailure | null;
}

const IDLE: SyncState = { isPending: false, isSuccess: false, data: undefined, error: null };
const mockSync: { current: SyncState } = { current: IDLE };

jest.mock('@/application/sync/use-synchronization', () => ({
  useSynchronize: () => ({ ...mockSync.current, mutate: jest.fn() }),
}));

function shown(state: Partial<SyncState>): string {
  mockSync.current = { ...IDLE, ...state };
  return renderedText(render(<SyncNowButton />));
}

describe('SyncNowButton', () => {
  it('reassures the technician that nothing was lost when there is no connection', () => {
    const text = shown({ error: { kind: 'network' } });

    expect(text).toContain('Sem conexão. Nada foi perdido');
    expect(text).toContain('serão enviados depois');
  });

  it('turns an expired session into an invitation to sign in again', () => {
    expect(shown({ error: { kind: 'unauthorized' } })).toContain('Sua sessão expirou');
  });

  it.each<[ApiFailure, string]>([
    [{ kind: 'server' }, 'O servidor está com problemas'],
    [{ kind: 'forbidden' }, 'Você não tem permissão'],
    [{ kind: 'conflict', code: 'SYNC_VERSION_CONFLICT' }, 'Este registro mudou em outro lugar'],
  ])('describes %j in business language, never by its code', (error, expected) => {
    const text = shown({ error });

    expect(text).toContain(expected);
    expect(text).not.toContain('SYNC_VERSION_CONFLICT');
    expect(text).not.toContain('Network request failed');
  });

  it('says how many records the server refused and that they stayed on the device', () => {
    const one = shown({ isSuccess: true, data: { sent: 3, refused: 1 } });
    const many = shown({ isSuccess: true, data: { sent: 0, refused: 2 } });

    expect(one).toContain('1 registro foi recusado pelo servidor e continua no aparelho.');
    expect(many).toContain('2 registros foram recusados pelo servidor e continuam no aparelho.');
  });

  it('confirms what was sent, and says when there was nothing to send', () => {
    expect(shown({ isSuccess: true, data: { sent: 1, refused: 0 } })).toContain(
      'Sincronizado. 1 registro enviado.'
    );
    expect(shown({ isSuccess: true, data: { sent: 4, refused: 0 } })).toContain(
      'Sincronizado. 4 registros enviados.'
    );
    expect(shown({ isSuccess: true, data: { sent: 0, refused: 0 } })).toContain(
      'Nada pendente de envio'
    );
  });

  it('shows only the button before the first attempt', () => {
    expect(shown({})).toBe('Sincronizar');
  });
});
