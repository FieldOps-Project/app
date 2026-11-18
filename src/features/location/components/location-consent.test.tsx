import { Button } from '@/design-system/components/button';
import { LocationConsent } from '@/features/location/components/location-consent';
import type { LocationPermissionState } from '@/infrastructure/location/capture-location';
import { render, renderedText } from '@/testing/render';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockPermission: { current: LocationPermissionState | null } = { current: null };

jest.mock('@/application/location/use-location-permission', () => ({
  useLocationPermission: () => mockPermission.current,
}));

describe('LocationConsent', () => {
  it.each<LocationPermissionState>(['denied', 'blocked'])(
    'says the inspection goes on without the position when the permission is %s',
    (permission) => {
      mockPermission.current = permission;

      const text = renderedText(render(<LocationConsent moment="start" />));

      expect(text).toContain('A permissão de localização está negada');
      expect(text).toContain('a inspeção começa assim mesmo');
      expect(text).toContain('a ausência fica registrada');
    }
  );

  it('says the same about the completion', () => {
    mockPermission.current = 'denied';

    const text = renderedText(render(<LocationConsent moment="completion" />));

    expect(text).toContain('a conclusão acontece assim mesmo');
  });

  it('points to the settings only when the system will not ask again', () => {
    mockPermission.current = 'blocked';
    expect(render(<LocationConsent moment="start" />).root.findAllByType(Button)).toHaveLength(1);

    mockPermission.current = 'denied';
    expect(render(<LocationConsent moment="start" />).root.findAllByType(Button)).toHaveLength(0);
  });

  it('explains the one-time reading before asking for the permission', () => {
    mockPermission.current = 'undetermined';

    const text = renderedText(render(<LocationConsent moment="start" />));

    expect(text).toContain('o aparelho pede permissão');
    expect(text).toContain('Não há rastreamento contínuo');
  });
});
