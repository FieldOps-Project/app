import { Badge, type BadgeIcon, type BadgeTone } from '@/design-system/components/badge';
import { SEVERITY_LABELS, type Severity } from '@/domain/non-conformity';

const TONES: Readonly<Record<Severity, BadgeTone>> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const ICONS: Readonly<Record<Severity, BadgeIcon>> = {
  LOW: 'remove-circle-outline',
  MEDIUM: 'information-circle-outline',
  HIGH: 'warning-outline',
  CRITICAL: 'alert-circle',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge
      tone={TONES[severity]}
      icon={ICONS[severity]}
      label={`Criticidade ${SEVERITY_LABELS[severity].toLowerCase()}`}
    />
  );
}
