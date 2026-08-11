import { useLocalSearchParams } from 'expo-router';

/**
 * Reads the `inspectionId` route parameter.
 *
 * Expo Router types a parameter as `string | string[]`, since a segment can
 * repeat in the URL. Normalising here keeps every inspection screen working
 * with a plain identifier.
 *
 * @returns The identifier, or an empty string when the route carries none.
 */
export function useInspectionId(): string {
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string | string[] }>();

  if (Array.isArray(inspectionId)) {
    return inspectionId[0] ?? '';
  }
  return inspectionId ?? '';
}
