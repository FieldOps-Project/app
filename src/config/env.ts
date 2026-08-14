import { z } from 'zod';

/**
 * Every `EXPO_PUBLIC_` value is inlined into the bundle and readable by anyone
 * who opens the app, so none may carry a key, password or server token. Reads
 * must be static `process.env.NAME`; the bundler does not resolve dynamic access.
 */
const environmentSchema = z.object({
  apiUrl: z
    .url({
      message: 'EXPO_PUBLIC_API_URL precisa ser uma URL absoluta, como http://192.168.0.10:8080',
    })
    .transform((url) => url.replace(/\/+$/, '')),
  appEnv: z.enum(['development', 'staging', 'production']).default('development'),
});

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

export const isDevelopment = env.appEnv === 'development';
