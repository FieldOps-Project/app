export interface FieldPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number | null;
  readonly capturedAt: string;
}

export type LocationAbsence = 'PERMISSION_DENIED' | 'SERVICES_DISABLED' | 'TIMEOUT' | 'UNAVAILABLE';

export const LOCATION_ABSENCES: readonly LocationAbsence[] = [
  'PERMISSION_DENIED',
  'SERVICES_DISABLED',
  'TIMEOUT',
  'UNAVAILABLE',
];

export type LocationCapture =
  | { readonly status: 'captured'; readonly position: FieldPosition }
  | { readonly status: 'missing'; readonly reason: LocationAbsence };

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
