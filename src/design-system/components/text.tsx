import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

/** Typographic role of the text. */
export type TextVariant = 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'code';

/** Semantic color of the text. */
export type TextTone = 'default' | 'muted' | 'brand' | 'success' | 'warning' | 'danger';

const variantClasses: Record<TextVariant, string> = {
  title: 'text-3xl font-bold',
  subtitle: 'text-xl font-semibold',
  body: 'text-base',
  label: 'text-sm font-semibold uppercase tracking-wide',
  caption: 'text-xs',
  code: 'text-sm font-mono',
};

const toneClasses: Record<TextTone, string> = {
  default: 'text-neutral-900 dark:text-neutral-50',
  muted: 'text-neutral-500 dark:text-neutral-400',
  brand: 'text-brand-700 dark:text-brand-300',
  success: 'text-success-strong dark:text-success',
  warning: 'text-warning-strong dark:text-warning',
  danger: 'text-danger-strong dark:text-danger',
};

export interface TextProps extends RNTextProps {
  /** Typographic role. Defaults to `body`. */
  variant?: TextVariant;
  /** Semantic color. Defaults to `default`. */
  tone?: TextTone;
  /** Extra utility classes appended after the variant and tone classes. */
  className?: string;
}

/**
 * Design system text.
 *
 * Size and color are chosen from a fixed set of variants and tones so screens
 * stay consistent and keep their contrast ratios.
 */
export function Text({ variant = 'body', tone = 'default', className, ...props }: TextProps) {
  return (
    <RNText
      className={`${variantClasses[variant]} ${toneClasses[tone]} ${className ?? ''}`}
      {...props}
    />
  );
}
