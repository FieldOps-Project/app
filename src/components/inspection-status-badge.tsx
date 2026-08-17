import { Badge, type BadgeIcon, type BadgeTone } from '@/design-system/components/badge';
import type { InspectionStatus } from '@/domain/inspection';
import { inspectionStatusLabel } from '@/domain/inspection';

/** Maps each delivery state to a colour and an icon; the label comes from the domain. */
const presentation: Record<InspectionStatus, { tone: BadgeTone; icon: BadgeIcon }> = {
  pendente: { tone: 'neutral', icon: 'time-outline' },
  'em-andamento': { tone: 'info', icon: 'construct-outline' },
  concluida: { tone: 'success', icon: 'checkmark-circle-outline' },
};

export interface InspectionStatusBadgeProps {
  status: InspectionStatus;
}

/** Business status of an inspection as a colour + icon + text badge. */
export function InspectionStatusBadge({ status }: InspectionStatusBadgeProps) {
  const { tone, icon } = presentation[status];
  return <Badge tone={tone} icon={icon} label={inspectionStatusLabel(status)} />;
}
