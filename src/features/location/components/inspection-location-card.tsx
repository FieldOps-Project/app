import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import type { InspectionDetail } from '@/domain/inspection';
import { LocationMap } from '@/features/location/components/location-map';
import {
  describeRecordedLocation,
  inspectionMarkers,
  type TransitionMoment,
} from '@/features/location/describe-location';
import { MARKER_COLORS, type MapMarkerKind } from '@/features/location/leaflet-html';

/**
 * Where the work happened (card #19): a map with the site's registered point
 * and the positions read at the start and at the completion, followed by the
 * same data as text — readable without tiles, and with the reason whenever a
 * position is missing.
 */
export function InspectionLocationCard({ detail }: { detail: InspectionDetail }) {
  const markers = useMemo(() => inspectionMarkers(detail), [detail]);
  const moments: TransitionMoment[] = [];
  if (detail.startedAtDevice !== null) {
    moments.push('start');
  }
  if (detail.completedAtDevice !== null) {
    moments.push('completion');
  }

  if (moments.length === 0) {
    return null;
  }

  return (
    <Card title="Localização registrada">
      {markers.length > 0 ? <LocationMap markers={markers} /> : null}
      {markers.length > 0 ? <Legend kinds={markers.map((marker) => marker.kind)} /> : null}
      {moments.map((moment) => {
        const recorded = moment === 'start' ? detail.startLocation : detail.completionLocation;
        const missing = recorded.status !== 'captured';
        return (
          <View key={moment} className="flex-row items-start gap-2">
            <Ionicons
              name={missing ? 'alert-circle-outline' : 'navigate-outline'}
              size={18}
              color={missing ? colors.warning.DEFAULT : colors.neutral[500]}
            />
            <Text variant="body" tone={missing ? 'warning' : 'default'} className="flex-1">
              {describeRecordedLocation(moment, recorded)}
            </Text>
          </View>
        );
      })}
      <Text variant="caption" tone="muted">
        Posição do aparelho do técnico no momento de cada ação, lida uma única vez — não é o
        endereço do local nem a posição do equipamento.
      </Text>
    </Card>
  );
}

const LEGEND_LABELS: Record<MapMarkerKind, string> = {
  site: 'Local cadastrado',
  start: 'Início',
  completion: 'Conclusão',
};

function Legend({ kinds }: { kinds: MapMarkerKind[] }) {
  const unique = [...new Set(kinds)];
  return (
    <View className="flex-row flex-wrap gap-3">
      {unique.map((kind) => (
        <View key={kind} className="flex-row items-center gap-1.5">
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: MARKER_COLORS[kind] }} />
          <Text variant="caption" tone="muted">
            {LEGEND_LABELS[kind]}
          </Text>
        </View>
      ))}
    </View>
  );
}
