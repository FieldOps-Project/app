import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Reusable empty state.
 *
 * Distinguishes "nothing here yet" from a failure: the tone is neutral and the
 * copy uses business language. An optional action gives the technician a way
 * forward instead of a dead end.
 */
export function EmptyState({
  title,
  description,
  icon = 'file-tray-outline',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="items-center gap-3 px-4 py-8">
      <Ionicons name={icon} size={40} color={colors.neutral[400]} />
      <Text variant="subtitle" tone="muted" className="text-center">
        {title}
      </Text>
      {description === undefined ? null : (
        <Text variant="body" tone="muted" className="text-center">
          {description}
        </Text>
      )}
      {actionLabel === undefined || onAction === undefined ? null : (
        <Button
          label={actionLabel}
          variant="secondary"
          onPress={onAction}
          className="self-stretch"
        />
      )}
    </View>
  );
}
