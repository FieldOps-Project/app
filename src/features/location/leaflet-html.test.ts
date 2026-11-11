import {
  buildLeafletHtml,
  drawableMarkers,
  type MapMarker,
} from '@/features/location/leaflet-html';

const START: MapMarker = {
  kind: 'start',
  latitude: -23.5012,
  longitude: -47.4531,
  accuracy: 18,
  label: 'Início da inspeção',
};

describe('buildLeafletHtml', () => {
  it('uses OpenStreetMap tiles and Leaflet, with no API key', () => {
    const html = buildLeafletHtml([START]);

    expect(html).toContain('tile.openstreetmap.org');
    expect(html).toContain('leaflet@1.9.4');
    expect(html).not.toMatch(/key=|googleapis/i);
  });

  it('carries the markers as data', () => {
    expect(buildLeafletHtml([START])).toContain('"latitude":-23.5012');
  });

  it('cannot be broken out of by a label', () => {
    const html = buildLeafletHtml([{ ...START, label: '</script><script>alert(1)</script>' }]);

    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script\\u003e');
  });
});

describe('drawableMarkers', () => {
  it('leaves out a coordinate outside the valid range', () => {
    expect(drawableMarkers([START, { ...START, latitude: 91 }])).toEqual([START]);
  });
});
