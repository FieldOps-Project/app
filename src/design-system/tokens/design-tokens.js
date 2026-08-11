/**
 * Visual tokens for FieldOps.
 *
 * Written in plain JavaScript because it is read both by `tailwind.config.js`,
 * which runs as CommonJS outside the bundler, and by the TypeScript app code.
 * A single file keeps the utility-class palette and the navigation-theme
 * palette from diverging.
 */

/** Color scale. `DEFAULT` is the shade applied when a class carries no suffix. */
const colors = {
  brand: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#2f7bef',
    600: '#1d5fd0',
    700: '#1a4bab',
    800: '#1a3f8a',
    900: '#1a376f',
    DEFAULT: '#1d5fd0',
  },
  neutral: {
    0: '#ffffff',
    50: '#f7f8fa',
    100: '#eef0f4',
    200: '#dfe3ea',
    300: '#c5ccd8',
    400: '#98a2b3',
    500: '#6b7280',
    600: '#4b5563',
    700: '#343b48',
    800: '#20252e',
    900: '#12151b',
    950: '#0a0c10',
  },
  success: { DEFAULT: '#15803d', soft: '#dcfce7', strong: '#166534' },
  warning: { DEFAULT: '#b45309', soft: '#fef3c7', strong: '#92400e' },
  danger: { DEFAULT: '#b91c1c', soft: '#fee2e2', strong: '#991b1b' },
  info: { DEFAULT: '#0369a1', soft: '#e0f2fe', strong: '#075985' },
};

/** Additional spacing steps that complement the default Tailwind scale. */
const spacing = {
  screen: '16px',
  'field-gap': '12px',
};

/** Border radii used by cards, fields and buttons. */
const borderRadius = {
  field: '10px',
  card: '14px',
};

/** Minimum touch target in pixels recommended by the Android accessibility guidelines. */
const minTouchTarget = 48;

module.exports = { colors, spacing, borderRadius, minTouchTarget };
