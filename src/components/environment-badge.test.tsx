import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

function badgeFor(appEnv: string): string {
  let text = '';
  jest.isolateModules(() => {
    jest.doMock('@/config/env', () => ({
      env: { appEnv },
      isProduction: appEnv === 'production',
      ENVIRONMENT_LABELS: {
        local: 'Local',
        integration: 'Integração',
        demo: 'Demonstração',
        production: 'Produção',
      },
    }));
    const { EnvironmentBadge } = jest.requireActual<
      typeof import('@/components/environment-badge')
    >('@/components/environment-badge');
    text = renderedText(render(<EnvironmentBadge />));
  });
  return text;
}

describe('EnvironmentBadge', () => {
  it.each([
    ['local', 'Ambiente: Local'],
    ['integration', 'Ambiente: Integração'],
    ['demo', 'Ambiente: Demonstração'],
  ])('flags the %s environment so test data is not taken for real', (appEnv, expected) => {
    expect(badgeFor(appEnv)).toContain(expected);
  });

  it('stays out of the way in production', () => {
    expect(badgeFor('production')).toBe('');
  });
});
