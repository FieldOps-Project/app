import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';

export interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Card({ children, title, className }: CardProps) {
  return (
    <View className={`gap-3 rounded-card bg-neutral-0 p-4 dark:bg-neutral-900 ${className ?? ''}`}>
      {title === undefined ? null : (
        <Text variant="label" tone="muted">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
