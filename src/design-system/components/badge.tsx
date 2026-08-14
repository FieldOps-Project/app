import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { Text, type TextTone } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type BadgeIcon = ComponentProps<typeof Ionicons>['name'];

/** Soft background per tone; the dark theme keeps a neutral chip with tinted content. */
const containerClasses: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-100 dark:bg-neutral-800',
  info: 'bg-info-soft dark:bg-neutral-800',
  success: 'bg-success-soft dark:bg-neutral-800',
  warning: 'bg-warning-soft dark:bg-neutral-800',
  danger: 'bg-danger-soft dark:bg-neutral-800',
};

const labelTones: Record<BadgeTone, TextTone> = {
  neutral: 'default',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

/** Mid tone reads on both the light soft background and the dark neutral chip. */
const iconColors: Record<BadgeTone, string> = {
  neutral: colors.neutral[500],
  info: colors.info.DEFAULT,
  success: colors.success.DEFAULT,
  warning: colors.warning.DEFAULT,
  danger: colors.danger.DEFAULT,
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: BadgeIcon;
  className?: string;
}

/**
 * State badge.
 *
 * Combines colour, icon and text so meaning survives colour blindness and
 * strong sunlight (document 13.9). Colour never carries the state on its own:
 * the label always names it.
 */
export function Badge({ label, tone = 'neutral', icon, className }: BadgeProps) {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${containerClasses[tone]} ${className ?? ''}`}
    >
      {icon === undefined ? null : <Ionicons name={icon} size={14} color={iconColors[tone]} />}
      <Text variant="caption" tone={labelTones[tone]} className="font-semibold">
        {label}
      </Text>
    </View>
  );
}
