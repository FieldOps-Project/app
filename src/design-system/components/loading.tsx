import { ActivityIndicator, View } from 'react-native';

import { Text } from '@/design-system/components/text';

export interface LoadingProps {
  /** Message shown under the spinner. */
  label?: string;
}

/** Full-screen loading state, used while a route guard resolves. */
export function Loading({ label }: LoadingProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-neutral-50 dark:bg-neutral-950">
      <ActivityIndicator size="large" />
      {label === undefined ? null : (
        <Text variant="body" tone="muted">
          {label}
        </Text>
      )}
    </View>
  );
}
