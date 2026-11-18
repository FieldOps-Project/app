import { Badge } from '@/design-system/components/badge';
import { SyncStateBadge } from '@/components/sync-state-badge';
import type { SyncState } from '@/domain/inspection';
import { render } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const STATES: SyncState[] = [
  'salvo-no-dispositivo',
  'aguardando-envio',
  'enviado',
  'falha',
  'conflito',
];

function badgeOf(state: SyncState) {
  return render(<SyncStateBadge state={state} />).root.findByType(Badge).props;
}

describe('SyncStateBadge', () => {
  it('tells the five states of document 13.8 apart by text and by icon, not by color alone', () => {
    const shown = STATES.map(badgeOf);

    expect(shown.map((badge) => badge.label)).toEqual([
      'Salvo no dispositivo',
      'Aguardando envio',
      'Enviado',
      'Falha no envio',
      'Conflito',
    ]);
    expect(new Set(shown.map((badge) => badge.icon)).size).toBe(STATES.length);
  });
});
