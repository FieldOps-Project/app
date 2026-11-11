/**
 * A position captured once, at the start or at the completion (card #19,
 * RN-060 to RN-062). It is where the technician's device was at that moment:
 * not the site's registered address and not the equipment.
 */
export interface FieldPosition {
  readonly latitude: number;
  readonly longitude: number;
  /** Radius in meters reported by the device; poor accuracy is information, not an error. */
  readonly accuracy: number | null;
  /** Device clock when the position was read (ISO 8601). */
  readonly capturedAt: string;
}

/** Why a position is missing. Never replaced by an invented or approximate coordinate. */
export type LocationAbsence = 'PERMISSION_DENIED' | 'SERVICES_DISABLED' | 'TIMEOUT' | 'UNAVAILABLE';

export const LOCATION_ABSENCES: readonly LocationAbsence[] = [
  'PERMISSION_DENIED',
  'SERVICES_DISABLED',
  'TIMEOUT',
  'UNAVAILABLE',
];

/** Outcome of one capture attempt. A capture never throws and never blocks the transition. */
export type LocationCapture =
  | { readonly status: 'captured'; readonly position: FieldPosition }
  | { readonly status: 'missing'; readonly reason: LocationAbsence };

/**
 * What the device knows about the position of one transition. `not-recorded`
 * is a transition that has not happened yet, or one downloaded from a server
 * that did not report a position.
 */
export type RecordedLocation = LocationCapture | { readonly status: 'not-recorded' };

export function isLocationAbsence(value: string): value is LocationAbsence {
  return (LOCATION_ABSENCES as readonly string[]).includes(value);
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Business language for the technician (document 13.9). */
export function locationAbsenceLabel(reason: LocationAbsence): string {
  const labels: Record<LocationAbsence, string> = {
    PERMISSION_DENIED: 'a permissão de localização foi negada',
    SERVICES_DISABLED: 'a localização do aparelho está desligada',
    TIMEOUT: 'o aparelho não encontrou a posição a tempo',
    UNAVAILABLE: 'a posição não estava disponível',
  };
  return labels[reason];
}

export function formatCoordinates(position: Pick<FieldPosition, 'latitude' | 'longitude'>): string {
  return `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`;
}

export function formatAccuracy(accuracy: number | null): string {
  return accuracy === null ? 'precisão não informada' : `precisão de ${Math.round(accuracy)} m`;
}
