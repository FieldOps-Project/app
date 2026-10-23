import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { ProgressBar } from '@/design-system/components/progress-bar';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import {
  pendingReasonLabel,
  type ChecklistProgress,
  type PendingItem,
} from '@/domain/checklist-progress';
import { plural } from '@/utils/plural';

export function progressLabel(progress: ChecklistProgress): string {
  return `${progress.answered} de ${plural(progress.applicable, 'item aplicável respondido', 'itens aplicáveis respondidos')}`;
}

export interface SectionTabsProps {
  progress: ChecklistProgress;
  onSelect: (sectionOrder: number) => void;
}

/**
 * Jump to a section, each showing its own count and, when done, a check —
 * completion read from icon and text, not colour (card #12, card #15).
 */
export function SectionTabs({ progress, onSelect }: SectionTabsProps) {
  if (progress.sections.length < 2) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {progress.sections.map((section) => (
        <Pressable
          key={section.order}
          accessibilityRole="button"
          accessibilityLabel={`${section.title}: ${section.answered} de ${section.applicable}${section.complete ? ', completa' : ''}`}
          onPress={() => onSelect(section.order)}
          style={{ minHeight: 48 }}
          className="flex-row items-center gap-1.5 rounded-full border border-neutral-300 bg-neutral-0 px-3 active:opacity-70 dark:border-neutral-700 dark:bg-neutral-900"
        >
          <Ionicons
            name={section.complete ? 'checkmark-circle' : 'ellipse-outline'}
            size={18}
            color={section.complete ? colors.success.DEFAULT : colors.neutral[400]}
          />
          <Text variant="body">{section.title}</Text>
          <Text variant="caption" tone="muted">
            {section.answered}/{section.applicable}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export interface PendingListProps {
  pending: readonly PendingItem[];
  onSelect: (itemId: string) => void;
}

/**
 * Everything that blocks the completion, each entry leading to its item
 * (card #15). Knowing that "3 are missing" is useless without knowing which.
 */
export function PendingList({ pending, onSelect }: PendingListProps) {
  return (
    <Card title={`Pendências (${pending.length})`}>
      {pending.length === 0 ? (
        <View className="flex-row items-center gap-2">
          <Ionicons name="checkmark-done-outline" size={20} color={colors.success.DEFAULT} />
          <Text variant="body" tone="success">
            Nenhuma pendência. A inspeção pode ser concluída.
          </Text>
        </View>
      ) : (
        pending.map((entry) => (
          <Pressable
            key={`${entry.itemId}-${entry.reason}`}
            accessibilityRole="button"
            accessibilityHint="Leva até o item"
            onPress={() => onSelect(entry.itemId)}
            style={{ minHeight: 48 }}
            className="flex-row items-center gap-2 active:opacity-70"
          >
            <Ionicons name="alert-circle-outline" size={20} color={colors.danger.DEFAULT} />
            <View className="flex-1">
              <Text variant="body">{entry.itemTitle}</Text>
              <Text variant="caption" tone="danger">
                {pendingReasonLabel(entry.reason)} · {entry.sectionTitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.neutral[400]} />
          </Pressable>
        ))
      )}
    </Card>
  );
}

export interface ProgressSummaryProps {
  progress: ChecklistProgress;
}

export function ProgressSummary({ progress }: ProgressSummaryProps) {
  return <ProgressBar percent={progress.percent} label={progressLabel(progress)} />;
}
