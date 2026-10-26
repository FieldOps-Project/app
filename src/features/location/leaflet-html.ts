import { isValidCoordinate } from '@/domain/field-location';
import { colors } from '@/design-system/tokens/design-tokens';

/**
 * A self-contained Leaflet page over OpenStreetMap tiles: no API key, no
 * billing account. The same page runs in a WebView on the device and in an
 * iframe on the web. Only the tiles need the network; the coordinates are
 * always printed next to the map, so the data survives a missing connection.
 */

export type MapMarkerKind = 'site' | 'start' | 'completion';

export interface MapMarker {
  readonly kind: MapMarkerKind;
  readonly latitude: number;
  readonly longitude: number;
  /** Accuracy radius in meters, drawn as a circle around captured positions. */
  readonly accuracy: number | null;
  readonly label: string;
}

export const MARKER_COLORS: Record<MapMarkerKind, string> = {
  site: colors.neutral[600],
  start: colors.brand[600],
  completion: colors.success.DEFAULT,
};

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

/** JSON inside a <script> must not be able to close the tag. */
function toScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Markers outside the valid range are left out rather than drawn in the wrong place. */
export function drawableMarkers(markers: readonly MapMarker[]): MapMarker[] {
  return markers.filter((marker) => isValidCoordinate(marker.latitude, marker.longitude));
}

export function buildLeafletHtml(markers: readonly MapMarker[]): string {
  const data = drawableMarkers(markers).map((marker) => ({
    ...marker,
    color: MARKER_COLORS[marker.kind],
  }));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${colors.neutral[100]}; }
  .pin { width: 14px; height: 14px; border: 3px solid #fff; border-radius: 50%;
         box-shadow: 0 1px 4px rgba(0,0,0,.45); }
  #offline { display: none; position: absolute; inset: 0; align-items: center;
             justify-content: center; padding: 16px; text-align: center;
             font: 14px/1.4 sans-serif; color: ${colors.neutral[600]}; }
</style>
</head>
<body>
<div id="map"></div>
<div id="offline">Mapa indisponível sem internet. As coordenadas estão abaixo.</div>
<script src="${LEAFLET}/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var markers = ${toScriptJson(data)};
  if (typeof L === 'undefined') {
    document.getElementById('offline').style.display = 'flex';
    return;
  }
  function escape(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var map = L.map('map', { zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  var bounds = [];
  markers.forEach(function (m) {
    var point = [m.latitude, m.longitude];
    bounds.push(point);
    if (m.accuracy !== null && m.accuracy > 0) {
      L.circle(point, { radius: m.accuracy, color: m.color, weight: 1, fillOpacity: 0.12 }).addTo(map);
    }
    L.marker(point, {
      title: m.label,
      icon: L.divIcon({
        className: '',
        html: '<div class="pin" style="background:' + m.color + '"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).bindPopup(escape(m.label) + '<br>' + m.latitude.toFixed(6) + ', ' + m.longitude.toFixed(6))
      .addTo(map);
  });
  if (bounds.length === 1) {
    map.setView(bounds[0], 17);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
  } else {
    map.setView([-14.235, -51.925], 3);
  }
})();
</script>
</body>
</html>`;
}
