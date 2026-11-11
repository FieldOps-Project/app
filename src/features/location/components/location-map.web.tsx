import { useMemo } from 'react';
import { View } from 'react-native';

import type { LocationMapProps } from '@/features/location/components/location-map';
import { buildLeafletHtml } from '@/features/location/leaflet-html';

/** The browser: the same Leaflet page, isolated in an iframe. */
export function LocationMap({ markers }: LocationMapProps) {
  const html = useMemo(() => buildLeafletHtml(markers), [markers]);

  return (
    <View className="h-56 overflow-hidden rounded-field bg-neutral-100 dark:bg-neutral-800">
      <iframe
        title="Mapa com as posições registradas da inspeção"
        srcDoc={html}
        sandbox="allow-scripts allow-popups"
        style={{ border: 0, width: '100%', height: '100%' }}
      />
    </View>
  );
}
