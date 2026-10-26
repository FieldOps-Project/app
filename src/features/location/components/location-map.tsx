import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { buildLeafletHtml, type MapMarker } from '@/features/location/leaflet-html';

export interface LocationMapProps {
  readonly markers: readonly MapMarker[];
}

/**
 * Android and iOS: the Leaflet page inside a WebView (Expo Go included).
 * Metro picks `location-map.web.tsx` for the browser.
 */
export function LocationMap({ markers }: LocationMapProps) {
  const html = useMemo(() => buildLeafletHtml(markers), [markers]);

  return (
    <View className="h-56 overflow-hidden rounded-field bg-neutral-100 dark:bg-neutral-800">
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        accessibilityLabel="Mapa com as posições registradas da inspeção"
      />
    </View>
  );
}
