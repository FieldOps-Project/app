import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { Text, type TextTone } from '@/design-system/components/text';
import { colors, minTouchTarget } from '@/design-system/tokens/design-tokens';

export type OptionTone = 'neutral' | 'success' | 'danger';

const selectedClasses: Record<OptionTone, string> = {
  neutral: 'border-brand-600 bg-brand-50 dark:bg-neutral-800',
  success: 'border-success bg-success-soft dark:bg-neutral-800',
  danger: 'border-danger bg-danger-soft dark:bg-neutral-800',
};

const selectedTones: Record<OptionTone, TextTone> = {
  neutral: 'brand',
  success: 'success',
  danger: 'danger',
};

const selectedIconColors: Record<OptionTone, string> = {
  neutral: colors.brand.DEFAULT,
  success: colors.success.DEFAULT,
  danger: colors.danger.DEFAULT,
};

export interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Tints the selected state; the label and the icon always carry the meaning. */
  tone?: OptionTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
}

/**
 * One choice of a single-choice group, large enough to hit with gloves in the
 * sun: a radio announced as checked or not, marked by border, fill and a
 * check icon together, never by colour alone (document 13.9).
 */
export function OptionButton({
  label,
  selected,
  onPress,
  tone = 'neutral',
  icon,
  disabled = false,
}: OptionButtonProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: minTouchTarget + 8 }}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-field border-2 px-3 active:opacity-70 ${
        selected
          ? selectedClasses[tone]
          : 'border-neutral-300 bg-neutral-0 dark:border-neutral-700 dark:bg-neutral-900'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : (icon ?? 'ellipse-outline')}
        size={20}
        color={selected ? selectedIconColors[tone] : colors.neutral[400]}
      />
      <Text
        variant="body"
        tone={selected ? selectedTones[tone] : 'default'}
        className="shrink font-semibold"
      >
        {label}
      </Text>
    </Pressable>
  );
}
