import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { Text } from '@/design-system/components/text';
import { minTouchTarget } from '@/design-system/tokens/design-tokens';

/** Visual weight of the button. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const containerClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 active:bg-brand-700',
  secondary: 'bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-800 dark:active:bg-neutral-700',
  danger: 'bg-danger active:bg-danger-strong',
};

const labelClasses: Record<ButtonVariant, string> = {
  primary: 'text-neutral-0',
  secondary: 'text-neutral-900 dark:text-neutral-50',
  danger: 'text-neutral-0',
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  /** Text shown inside the button. */
  label: string;
  /** Visual weight. Defaults to `primary`. */
  variant?: ButtonVariant;
  /**
   * Shows a spinner and disables the button. Defaults to `false`.
   *
   * Disabling while in flight prevents duplicate submission of the same
   * operation.
   */
  loading?: boolean;
  /** Extra utility classes appended to the container classes. */
  className?: string;
}

/**
 * Design system button.
 *
 * Minimum height follows the Android touch target guideline, since the app is
 * operated in the field.
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
      {loading ? <ActivityIndicator size="small" color="#ffffff" /> : null}
      <Text variant="body" className={`font-semibold ${labelClasses[variant]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
