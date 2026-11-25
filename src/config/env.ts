import { z } from 'zod';

export const APP_ENVIRONMENTS = ['local', 'integration', 'demo', 'production'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export const ENVIRONMENT_LABELS: Readonly<Record<AppEnvironment, string>> = {
  local: 'Local',
  integration: 'Integração',
  demo: 'Demonstração',
  production: 'Produção',
};

const environmentSchema = z.object({
  apiUrl: z
    .url({
      message: 'EXPO_PUBLIC_API_URL precisa ser uma URL absoluta, como http://192.168.0.10:8080',
    })
    .transform((url) => url.replace(/\/+$/, '')),
  appEnv: z.enum(APP_ENVIRONMENTS).default('local'),
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

export const isDevelopment = env.appEnv === 'local';

export const isProduction = env.appEnv === 'production';
