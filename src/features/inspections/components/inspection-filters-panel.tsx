import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Chip } from '@/design-system/components/chip';
import { Text } from '@/design-system/components/text';
import {
  inspectionStatusLabel,
  priorityLabel,
  type InspectionPriority,
  type InspectionStatus,
} from '@/domain/inspection';
import {
  dateRangeLabel,
  type DateRange,
  type InspectionFilters,
} from '@/domain/inspection-filters';

const STATUS_OPTIONS: readonly InspectionStatus[] = [
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REJECTED',
  'APPROVED',
  'CANCELED',
];

const PRIORITY_OPTIONS: readonly InspectionPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const DATE_OPTIONS: readonly DateRange[] = ['all', 'today', 'overdue', 'next-7-days'];

function toggle<TValue>(values: readonly TValue[], value: TValue): readonly TValue[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export interface InspectionFiltersPanelProps {
  filters: InspectionFilters;
  onChange: (filters: InspectionFilters) => void;
}

/** Status, date and priority, each a group of chips; groups combine with each other. */
export function InspectionFiltersPanel({ filters, onChange }: InspectionFiltersPanelProps) {
  return (
    <View className="gap-4">
      <Group title="Data">
        {DATE_OPTIONS.map((range) => (
          <Chip
            key={range}
            label={dateRangeLabel(range)}
            selected={filters.dateRange === range}
            onPress={() => onChange({ ...filters, dateRange: range })}
          />
        ))}
      </Group>

      <Group title="Estado">
        {STATUS_OPTIONS.map((status) => (
          <Chip
            key={status}
            label={inspectionStatusLabel(status)}
            selected={filters.statuses.includes(status)}
            onPress={() => onChange({ ...filters, statuses: toggle(filters.statuses, status) })}
          />
        ))}
      </Group>

      <Group title="Prioridade">
        {PRIORITY_OPTIONS.map((priority) => (
          <Chip
            key={priority}
            label={priorityLabel(priority)}
            selected={filters.priorities.includes(priority)}
            onPress={() =>
              onChange({ ...filters, priorities: toggle(filters.priorities, priority) })
            }
          />
        ))}
      </Group>

      <Group title="Sincronização">
        <Chip
          label="Somente não enviadas"
          selected={filters.unsentOnly}
          onPress={() => onChange({ ...filters, unsentOnly: !filters.unsentOnly })}
        />
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}
