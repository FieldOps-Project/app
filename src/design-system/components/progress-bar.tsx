import { View } from 'react-native';

import { Text } from '@/design-system/components/text';

export interface ProgressBarProps {
  /** 0–100. */
  percent: number;
  /** Always shown next to the bar: the bar alone is not enough (document 13.9). */
  label: string;
}

/**
 * Progress bar with its value in words. Announced as a progress bar with the
 * same text, so the number reaches screen readers too.
 */
export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      className="gap-1.5"
    >
      <View className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <View
          className={`h-full rounded-full ${clamped === 100 ? 'bg-success' : 'bg-brand-600'}`}
          style={{ width: `${clamped}%` }}
        />
      </View>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}
