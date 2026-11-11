import { deleteFile, evidenceFileUri } from '@/infrastructure/evidence/photo-storage';

/**
 * What the evidence screens need from the file system, kept behind the
 * application layer so features never reach the infrastructure directly.
 */

/** The URI an `Image` can load for a stored evidence path. */
export function evidenceImageUri(path: string): string {
  return evidenceFileUri(path);
}

/** Throws away a photo the technician retook or discarded; it lives in the cache. */
export function discardCapturedPhoto(uri: string): void {
  deleteFile(uri);
}
