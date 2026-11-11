import {
  formatAccuracy,
  formatCoordinates,
  locationAbsenceLabel,
  type RecordedLocation,
} from '@/domain/field-location';
import type { InspectionDetail } from '@/domain/inspection';
import type { MapMarker } from '@/features/location/leaflet-html';
import { formatDateTime } from '@/utils/format-date';

export type TransitionMoment = 'start' | 'completion';

const MOMENT_LABELS: Record<TransitionMoment, string> = {
  start: 'Início',
  completion: 'Conclusão',
};

/** One sentence per transition, for the technician and for the review (AC-LOCATION). */
export function describeRecordedLocation(
  moment: TransitionMoment,
  recorded: RecordedLocation
): string {
  const label = MOMENT_LABELS[moment];
  switch (recorded.status) {
    case 'captured':
      return `${label}: ${formatCoordinates(recorded.position)} (${formatAccuracy(
        recorded.position.accuracy
      )}), lida em ${formatDateTime(recorded.position.capturedAt)}.`;
    case 'missing':
      return `${label} sem localização: ${locationAbsenceLabel(recorded.reason)}.`;
    case 'not-recorded':
      return `${label}: localização não informada.`;
  }
}

/**
 * The site's registered point and the positions read in the field, kept
 * apart: the site is where the inspection should happen, the others are where
 * the technician's device was when it started and when it was completed.
 */
export function inspectionMarkers(detail: InspectionDetail): MapMarker[] {
  const markers: MapMarker[] = [];
  if (detail.site.latitude !== null && detail.site.longitude !== null) {
    markers.push({
      kind: 'site',
      latitude: detail.site.latitude,
      longitude: detail.site.longitude,
      accuracy: null,
      label: `Local cadastrado: ${detail.site.name}`,
    });
  }
  const moments: [TransitionMoment, RecordedLocation][] = [
    ['start', detail.startLocation],
    ['completion', detail.completionLocation],
  ];
  for (const [moment, recorded] of moments) {
    if (recorded.status === 'captured') {
      markers.push({
        kind: moment,
        latitude: recorded.position.latitude,
        longitude: recorded.position.longitude,
        accuracy: recorded.position.accuracy,
        label: `${MOMENT_LABELS[moment]} da inspeção`,
      });
    }
  }
  return markers;
}
