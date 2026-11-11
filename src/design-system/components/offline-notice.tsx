import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export interface OfflineNoticeProps {
  message?: string;
  className?: string;
}

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
