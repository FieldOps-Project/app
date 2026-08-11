import { useLocalSearchParams } from 'expo-router';

/**
 * Reads the `inspectionId` route parameter, which Expo Router types as
 * `string | string[]` because a segment can repeat in the URL.
 */
export function useInspectionId(): string {
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string | string[] }>();

  if (Array.isArray(inspectionId)) {
    return inspectionId[0] ?? '';
  }
  return inspectionId ?? '';
}
