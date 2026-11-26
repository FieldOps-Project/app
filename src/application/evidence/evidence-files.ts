import { deleteFile, evidenceFileUri, isCacheUri } from '@/infrastructure/evidence/photo-storage';

export function evidenceImageUri(path: string): string {
  return evidenceFileUri(path);
}

export function discardCapturedPhoto(uri: string): void {
  deleteFile(uri);
}

export function isCapturedPhotoUri(uri: string | undefined): uri is string {
  return uri !== undefined && isCacheUri(uri);
}
