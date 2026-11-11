import { deleteFile, evidenceFileUri } from '@/infrastructure/evidence/photo-storage';

export function evidenceImageUri(path: string): string {
  return evidenceFileUri(path);
}

export function discardCapturedPhoto(uri: string): void {
  deleteFile(uri);
}
