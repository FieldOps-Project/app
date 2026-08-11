import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/design-system/components/text';

export interface CardProps {
  children: ReactNode;
  /** Optional heading rendered above the content. */
  title?: string;
  /** Extra utility classes appended to the container classes. */
  className?: string;
}

/** Surface grouping related content, with the shared radius, padding and background. */
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
