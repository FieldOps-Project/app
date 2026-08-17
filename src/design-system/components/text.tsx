import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

export type TextVariant = 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'code';

export type TextTone =
  'default' | 'muted' | 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'inverse';

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
  info: 'text-info-strong dark:text-info',
  success: 'text-success-strong dark:text-success',
  warning: 'text-warning-strong dark:text-warning',
  danger: 'text-danger-strong dark:text-danger',
  inverse: 'text-neutral-0',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  className?: string;
}

/**
 * Design system text.
 *
 * Colour must be chosen through `tone`, never through `className`. Tailwind
 * resolves conflicting utilities by their order in the generated stylesheet,
 * not by the order they appear in the class string, so a colour passed in
 * `className` can silently lose to the tone class.
 */
export function Text({ variant = 'body', tone = 'default', className, ...props }: TextProps) {
  return (
    <RNText
      className={`${variantClasses[variant]} ${toneClasses[tone]} ${className ?? ''}`}
      {...props}
    />
  );
}
