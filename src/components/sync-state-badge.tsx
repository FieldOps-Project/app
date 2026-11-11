import { Badge, type BadgeIcon, type BadgeTone } from '@/design-system/components/badge';
import type { SyncState } from '@/domain/inspection';
import { syncStateLabel } from '@/domain/inspection';

const presentation: Record<SyncState, { tone: BadgeTone; icon: BadgeIcon }> = {
  'salvo-no-dispositivo': { tone: 'neutral', icon: 'save-outline' },
  'aguardando-envio': { tone: 'warning', icon: 'cloud-upload-outline' },
  enviado: { tone: 'success', icon: 'checkmark-done-outline' },
  falha: { tone: 'danger', icon: 'alert-circle-outline' },
  conflito: { tone: 'danger', icon: 'git-compare-outline' },
};

export interface SyncStateBadgeProps {
  state: SyncState;
}

export function SyncStateBadge({ state }: SyncStateBadgeProps) {
  const { tone, icon } = presentation[state];
  return <Badge tone={tone} icon={icon} label={syncStateLabel(state)} />;
}
