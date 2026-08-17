import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/design-system/components/text';
import { colors, minTouchTarget } from '@/design-system/tokens/design-tokens';

export interface InputProps extends Omit<TextInputProps, 'style' | 'className'> {
  label: string;
  /** Business-language message shown next to the field (document 13.9). */
  error?: string;
  /** Supporting text shown while the field is valid. */
  hint?: string;
  className?: string;
}

/**
 * Design system text field.
 *
 * The label and the error text stay next to the field so the technician does
 * not have to look elsewhere to understand what is wrong. Minimum height
 * follows the Android touch target guideline, and the invalid state is marked
 * by border, icon and text together, never colour alone.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, className, ...props },
  ref
) {
  const isInvalid = error !== undefined;

  return (
    <View className={`gap-1.5 ${className ?? ''}`}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        aria-invalid={isInvalid}
        placeholderTextColor={colors.neutral[400]}
        style={{ minHeight: minTouchTarget }}
        className={`rounded-field border bg-neutral-0 px-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50 ${
          isInvalid
            ? 'border-danger'
            : 'border-neutral-300 focus:border-brand-600 dark:border-neutral-700'
        }`}
        {...props}
      />
      {isInvalid ? (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="alert-circle" size={16} color={colors.danger.DEFAULT} />
          <Text variant="caption" tone="danger" className="flex-1">
            {error}
          </Text>
        </View>
      ) : hint === undefined ? null : (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      )}
    </View>
  );
});
