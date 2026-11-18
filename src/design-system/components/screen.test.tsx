import { Text } from 'react-native';

import { Screen } from '@/design-system/components/screen';
import { ScreenBannerProvider } from '@/design-system/components/screen-banner';
import { render, renderedText } from '@/testing/render';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View };
});

describe('Screen banner slot', () => {
  it('shows the global banner above the content of every screen', () => {
    const text = renderedText(
      render(
        <ScreenBannerProvider banner={<Text>Modo offline</Text>}>
          <Screen>
            <Text>Conteúdo</Text>
          </Screen>
        </ScreenBannerProvider>
      )
    );

    expect(text.indexOf('Modo offline')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('Modo offline')).toBeLessThan(text.indexOf('Conteúdo'));
  });

  it('keeps the banner outside the scrolling area', () => {
    const renderer = render(
      <ScreenBannerProvider banner={<Text>Modo offline</Text>}>
        <Screen scrollable>
          <Text>Conteúdo</Text>
        </Screen>
      </ScreenBannerProvider>
    );

    const scroll = renderer.root.findAll((node) => String(node.type).includes('ScrollView'))[0];
    expect(scroll).toBeDefined();
    expect(JSON.stringify(scroll?.props.children)).not.toContain('Modo offline');
  });

  it('renders the screen as before when there is no banner', () => {
    expect(
      renderedText(
        render(
          <Screen>
            <Text>Conteúdo</Text>
          </Screen>
        )
      )
    ).toBe('Conteúdo');
  });
});
