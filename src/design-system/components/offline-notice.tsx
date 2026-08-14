import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export interface OfflineNoticeProps {
  /** Overrides the default message for a screen-specific wording. */
  message?: string;
  className?: string;
}

/**
 * Reusable offline banner.
 *
 * Kept in the design system from the start because document 13.8 requires the
 * connectivity state to stay visible on every screen from sprint 6 onward.
 * Icon plus text carry the meaning; the warning tone only reinforces it.
 */
export function OfflineNotice({ message, className }: OfflineNoticeProps) {
  return (
    <View
      accessibilityRole="alert"
      className={`flex-row items-center gap-2 rounded-field bg-warning-soft px-3 py-2 dark:bg-neutral-800 ${className ?? ''}`}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning.DEFAULT} />
      <Text variant="caption" tone="warning" className="flex-1 font-semibold">
        {message ?? 'Sem conexão. Os dados serão enviados quando a internet voltar.'}
      </Text>
    </View>
  );
}
