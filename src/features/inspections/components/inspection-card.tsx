import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { InspectionStatusBadge } from '@/components/inspection-status-badge';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Badge } from '@/design-system/components/badge';
import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { isUrgentPriority, priorityLabel, type InspectionSummary } from '@/domain/inspection';
import { formatDateTime } from '@/utils/format-date';

export interface InspectionCardProps {
  inspection: InspectionSummary;
  overdue: boolean;
}

/**
 * List card (document 13.4): client, site, equipment, due date and state.
 *
 * Business status and sync state are two separate badges because they are
 * independent (document 7.5): "em andamento" and "aguardando envio" can be
 * true at once, and each must still be readable on its own.
 */
export function InspectionCard({ inspection, overdue }: InspectionCardProps) {
  return (
    <Card>
      <View className="gap-0.5">
        <Text variant="subtitle">{inspection.clientName}</Text>
        <Text variant="body" tone="muted">
          {inspection.title}
        </Text>
      </View>

      <View className="gap-1">
        <Detail icon="location-outline" text={inspection.siteName} />
        {inspection.equipmentName === null ? null : (
          <Detail icon="hardware-chip-outline" text={inspection.equipmentName} />
        )}
        <Detail
          icon="calendar-outline"
          text={`Prazo: ${formatDateTime(inspection.scheduledFor)}`}
          tone={overdue ? 'danger' : 'muted'}
        />
      </View>

      <View className="flex-row flex-wrap items-center gap-2">
        <InspectionStatusBadge status={inspection.status} />
        <SyncStateBadge state={inspection.syncState} />
        {overdue ? <Badge tone="danger" icon="alarm-outline" label="Atrasada" /> : null}
        {isUrgentPriority(inspection.priority) ? (
          <Badge
            tone="warning"
            icon="flag-outline"
            label={`Prioridade ${priorityLabel(inspection.priority).toLowerCase()}`}
          />
        ) : null}
      </View>
    </Card>
  );
}

interface DetailProps {
  icon: 'location-outline' | 'hardware-chip-outline' | 'calendar-outline';
  text: string;
  tone?: 'muted' | 'danger';
}

function Detail({ icon, text, tone = 'muted' }: DetailProps) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons
        name={icon}
        size={16}
        color={tone === 'danger' ? colors.danger.DEFAULT : colors.neutral[500]}
      />
      <Text variant="body" tone={tone} className="flex-1">
        {text}
      </Text>
    </View>
  );
}
