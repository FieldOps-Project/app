import { Badge, type BadgeIcon, type BadgeTone } from '@/design-system/components/badge';
import type { InspectionStatus } from '@/domain/inspection';
import { inspectionStatusLabel } from '@/domain/inspection';

const presentation: Record<InspectionStatus, { tone: BadgeTone; icon: BadgeIcon }> = {
  DRAFT: { tone: 'neutral', icon: 'document-outline' },
  ASSIGNED: { tone: 'neutral', icon: 'time-outline' },
  IN_PROGRESS: { tone: 'info', icon: 'construct-outline' },
  SUBMITTED: { tone: 'success', icon: 'checkmark-circle-outline' },
  UNDER_REVIEW: { tone: 'info', icon: 'eye-outline' },
  APPROVED: { tone: 'success', icon: 'ribbon-outline' },
  REJECTED: { tone: 'danger', icon: 'arrow-undo-outline' },
  CANCELED: { tone: 'neutral', icon: 'close-circle-outline' },
};

export interface InspectionStatusBadgeProps {
  status: InspectionStatus;
}

export function InspectionStatusBadge({ status }: InspectionStatusBadgeProps) {
  const { tone, icon } = presentation[status];
  return <Badge tone={tone} icon={icon} label={inspectionStatusLabel(status)} />;
}
