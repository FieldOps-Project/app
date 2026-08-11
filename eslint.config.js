const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/**
 * Interface layers, from the outermost inwards.
 *
 * Referenced by the boundary rules below so that no inner layer imports from a
 * layer closer to the screen.
 */
const UI_LAYERS = [
  '@/app',
  '@/app/*',
  '@/features',
  '@/features/*',
  '@/components',
  '@/components/*',
  '@/design-system',
  '@/design-system/*',
];

/** Infrastructure layer: API, database, files and connectivity. */
const INFRASTRUCTURE_LAYER = ['@/infrastructure', '@/infrastructure/*'];

/**
 * Relative paths climbing two or more levels.
 *
 * Blocked because they cross a layer boundary while bypassing the alias-based
 * rules below. Imports between folders use the `@/` alias.
 */
const DEEP_RELATIVE = ['../../*', '../../**'];

/**
 * Builds a `no-restricted-imports` rule entry.
 *
 * @param {string[]} patterns Import patterns to reject.
 * @param {string} message Explanation reported on violation.
 * @returns {Record<string, unknown>} Rules object for a flat config block.
 */
function restrict(patterns, message) {
  return {
    'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
  };
}

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'expo-env.d.ts', '*.log'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: DEEP_RELATIVE, message: 'Use the "@/" alias to import across folders.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: restrict(
      [
        ...UI_LAYERS,
        ...INFRASTRUCTURE_LAYER,
        '@/application',
        '@/application/*',
        '@/hooks',
        '@/hooks/*',
        'react',
        'react-native',
        'react-native-*',
        'expo',
        'expo-*',
        '@expo/*',
        '@tanstack/*',
        'axios',
        ...DEEP_RELATIVE,
      ],
      'src/domain must not depend on the interface, on infrastructure or on platform libraries (document 11.4).'
    ),
  },
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: restrict(
      [...UI_LAYERS, ...DEEP_RELATIVE],
      'src/application must not depend on the interface layer (document 11.4).'
    ),
  },
  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    rules: restrict(
      [...UI_LAYERS, ...DEEP_RELATIVE],
      'src/infrastructure must not depend on the interface layer (document 11.4).'
    ),
  },
  {
    files: ['src/design-system/**/*.{ts,tsx}'],
    rules: restrict(
      [
        '@/app',
        '@/app/*',
        '@/features',
        '@/features/*',
        ...INFRASTRUCTURE_LAYER,
        '@/application',
        '@/application/*',
        ...DEEP_RELATIVE,
      ],
      'src/design-system is visual only: it must not depend on routes, features, application or infrastructure.'
    ),
  },
];
