import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColorScheme, View } from 'react-native';

import { Text, type TextTone } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type BadgeIcon = ComponentProps<typeof Ionicons>['name'];

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

const iconColors: Record<'light' | 'dark', Record<BadgeTone, string>> = {
  light: {
    neutral: colors.neutral[500],
    info: colors.info.DEFAULT,
    success: colors.success.DEFAULT,
    warning: colors.warning.DEFAULT,
    danger: colors.danger.DEFAULT,
  },
  dark: {
    neutral: colors.neutral[400],
    info: colors.info.light,
    success: colors.success.light,
    warning: colors.warning.light,
    danger: colors.danger.light,
  },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: BadgeIcon;
  className?: string;
}

export function Badge({ label, tone = 'neutral', icon, className }: BadgeProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${containerClasses[tone]} ${className ?? ''}`}
    >
      {icon === undefined ? null : (
        <Ionicons name={icon} size={14} color={iconColors[scheme][tone]} />
      )}
      <Text variant="caption" tone={labelTones[tone]} className="font-semibold">
        {label}
      </Text>
    </View>
  );
}
