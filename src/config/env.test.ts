type EnvModule = typeof import('@/config/env');

function load(values: Record<string, string | undefined>): EnvModule {
  const previous = { ...process.env };
  Object.assign(process.env, { EXPO_PUBLIC_API_URL: 'http://api.test:8080/' }, values);
  let loaded: EnvModule | undefined;
  try {
    jest.isolateModules(() => {
      loaded = jest.requireActual<EnvModule>('@/config/env');
    });
  } finally {
    process.env = previous;
  }
  if (loaded === undefined) {
    throw new Error('O módulo de ambiente não carregou.');
  }
  return loaded;
}

const { APP_ENVIRONMENTS, ENVIRONMENT_LABELS } = load({});

describe('env', () => {
  it.each(APP_ENVIRONMENTS)('switches to %s without touching code', (appEnv) => {
    const { env, isProduction } = load({
      EXPO_PUBLIC_APP_ENV: appEnv,
      EXPO_PUBLIC_API_URL: 'https://api.fieldops.test/',
    });

    expect(env.appEnv).toBe(appEnv);
    expect(isProduction).toBe(appEnv === 'production');
  });

  it('defaults to the local environment and trims the API url', () => {
    const { env, isDevelopment } = load({ EXPO_PUBLIC_APP_ENV: undefined });

    expect(env.appEnv).toBe('local');
    expect(isDevelopment).toBe(true);
    expect(env.apiUrl).toBe('http://api.test:8080');
  });

  it('refuses an environment that does not exist', () => {
    expect(() => load({ EXPO_PUBLIC_APP_ENV: 'staging' })).toThrow('Configuração de ambiente');
  });

  it.each(['integration', 'demo', 'production'])(
    'refuses a plain http API url in the %s environment',
    (appEnv) => {
      expect(() =>
        load({ EXPO_PUBLIC_APP_ENV: appEnv, EXPO_PUBLIC_API_URL: 'http://api.fieldops.test' })
      ).toThrow('precisa usar https://');
    }
  );

  it('accepts a plain http API url only in the local environment', () => {
    expect(
      load({ EXPO_PUBLIC_APP_ENV: 'local', EXPO_PUBLIC_API_URL: 'http://10.0.2.2:8080' }).env.apiUrl
    ).toBe('http://10.0.2.2:8080');
  });

  it('names every environment for the person using the app', () => {
    expect(Object.keys(ENVIRONMENT_LABELS).sort()).toEqual([...APP_ENVIRONMENTS].sort());
  });
});
