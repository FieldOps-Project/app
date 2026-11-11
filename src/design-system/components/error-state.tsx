import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export interface ErrorStateProps {
  title?: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = 'Algo não funcionou',
  description,
  retryLabel = 'Tentar novamente',
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <View className="items-center gap-3 px-4 py-6">
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger.DEFAULT} />
      <Text variant="subtitle" tone="danger" className="text-center">
        {title}
      </Text>
      <Text variant="body" tone="muted" className="text-center">
        {description}
      </Text>
      {onRetry === undefined ? null : (
        <Button
          label={retryLabel}
          variant="secondary"
          loading={retrying}
          onPress={onRetry}
          className="self-stretch"
        />
      )}
    </View>
  );
}
