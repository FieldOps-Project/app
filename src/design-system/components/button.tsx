import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Text, type TextTone } from '@/design-system/components/text';
import { colors, minTouchTarget } from '@/design-system/tokens/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 active:bg-brand-700',
  secondary: 'bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-800 dark:active:bg-neutral-700',
  danger: 'bg-danger active:bg-danger-strong',
};

/** Solid backgrounds carry white text; the light surface keeps the default colour. */
const labelTones: Record<ButtonVariant, TextTone> = {
  primary: 'inverse',
  secondary: 'default',
  danger: 'inverse',
};

const spinnerColors: Record<ButtonVariant, string> = {
  primary: colors.neutral[0],
  secondary: colors.neutral[500],
  danger: colors.neutral[0],
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
}

/**
 * Design system button.
 *
 * Minimum height follows the Android touch target guideline, since the app is
 * operated in the field. Disabling while loading prevents duplicate submission
 * of the same operation.
 */
export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={{ minHeight: minTouchTarget }}
      className={`flex-row items-center justify-center gap-2 rounded-field px-4 ${
        containerClasses[variant]
      } ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={spinnerColors[variant]} /> : null}
      <Text variant="body" tone={labelTones[variant]} className="font-semibold">
        {label}
      </Text>
    </Pressable>
  );
}
