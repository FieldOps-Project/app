import { z } from 'zod';

/**
 * Schema for the environment configuration.
 *
 * Every `EXPO_PUBLIC_` value is inlined into the bundle and readable by anyone
 * who opens the app, so it must not carry keys, passwords or server tokens.
 * Per-device secrets go to `expo-secure-store` once authentication lands (EP-02).
 *
 * Values must be read through static `process.env.NAME` access; the bundler
 * does not resolve dynamic access.
 */
const environmentSchema = z.object({
  /** Base URL of the REST API, without a trailing slash. */
  apiUrl: z
    .url({
      message: 'EXPO_PUBLIC_API_URL precisa ser uma URL absoluta, como http://192.168.0.10:8080',
    })
    .transform((url) => url.replace(/\/+$/, '')),
  /** Logical environment of the build. */
  appEnv: z.enum(['development', 'staging', 'production']).default('development'),
});

/** Validated environment configuration. */
export type Environment = z.infer<typeof environmentSchema>;

const parsed = environmentSchema.safeParse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
});

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
    .join('\n');

  throw new Error(
    'Configuração de ambiente inválida.\n' +
      `${problems}\n\n` +
      'Copie o arquivo .env.example para .env, preencha os valores e reinicie o ' +
      'servidor com "npx expo start --clear". Variáveis EXPO_PUBLIC_ são lidas ' +
      'no momento do bundle, então alterar o .env com o Metro em execução não ' +
      'tem efeito.'
  );
}

export const env: Environment = parsed.data;

/** Whether the build is running with the development profile. */
export const isDevelopment = env.appEnv === 'development';
