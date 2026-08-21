const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

/** Interface layers. No inner layer may import from a layer closer to the screen. */
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

const INFRASTRUCTURE_LAYER = ['@/infrastructure', '@/infrastructure/*'];

/** Relative paths climbing two or more levels bypass the alias-based rules below. */
const DEEP_RELATIVE = ['../../*', '../../**'];

function restrict(patterns, message) {
  return {
    'no-restricted-imports': ['error', { patterns: [{ group: patterns, message }] }],
  };
}

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'expo-env.d.ts',
      'src/infrastructure/api/generated/schema.d.ts',
      '*.log',
    ],
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
