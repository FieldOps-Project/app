import { useLocalSearchParams } from 'expo-router';

export function useInspectionId(): string {
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string | string[] }>();

  if (Array.isArray(inspectionId)) {
    return inspectionId[0] ?? '';
  }
  return inspectionId ?? '';
}
