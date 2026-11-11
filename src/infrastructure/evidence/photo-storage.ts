import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  checkPhoto,
  fitWithin,
  PHOTO_MAX_EDGE,
  PHOTO_MIME_TYPE,
  PHOTO_QUALITY,
  THUMBNAIL_MAX_EDGE,
  THUMBNAIL_QUALITY,
  type PhotoRejection,
} from '@/domain/evidence';
import { fail, ok, type Result } from '@/domain/result';

/** A picture on disk and its size in pixels: what the camera returns, in the cache. */
export interface CapturedPhoto {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Where the evidence files were kept. The paths are relative to the app's
 * document directory, not absolute URIs: iOS moves the app container on every
 * update, so an absolute path saved today would point nowhere tomorrow.
 */
export interface StoredPhoto {
  readonly photoPath: string;
  readonly thumbnailPath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export type StorePhotoFailure =
  { readonly kind: 'rejected'; readonly reason: PhotoRejection } | { readonly kind: 'storage' };

/** Evidence files live under the document directory, which the system never clears (RN-047). */
const EVIDENCE_ROOT = 'evidences';

/**
 * The URI to read or delete a stored file. Accepts the relative paths this
 * module saves and, for anything older, an absolute URI as it is.
 */
export function evidenceFileUri(path: string): string {
  return path.includes('://') ? path : new File(Paths.document, path).uri;
}

async function render(photo: CapturedPhoto, maxEdge: number, quality: number) {
  const context = ImageManipulator.manipulate(photo.uri);
  try {
    const size = fitWithin(photo.width, photo.height, maxEdge);
    if (size !== null) {
      context.resize(size);
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
      return { file: new File(saved.uri), width: saved.width, height: saved.height };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Removes a file if it is there; a file already gone is not an error. */
export function deleteFile(path: string | null): void {
  if (path === null) {
    return;
  }
  try {
    const file = new File(evidenceFileUri(path));
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Nothing to do: the file is unreachable or already gone.
  }
}

/**
 * Turns a captured photo into an evidence file (document 13.10): resized to a
 * useful size, compressed as JPEG, checked against RN-046 and moved out of the
 * cache into the persistent directory, with its thumbnail beside it. The
 * thumbnail is made from the resized copy, so the large original is decoded
 * once. Nothing is left behind on failure. The camera's own file is left
 * alone, so a failed attempt can be retried; the caller removes it once the
 * evidence is saved.
 */
export async function storePhoto(
  photo: CapturedPhoto,
  target: { readonly inspectionId: string; readonly evidenceId: string }
): Promise<Result<StoredPhoto, StorePhotoFailure>> {
  const rendered: File[] = [];
  try {
    const full = await render(photo, PHOTO_MAX_EDGE, PHOTO_QUALITY);
    rendered.push(full.file);
    const thumbnail = await render(
      { uri: full.file.uri, width: full.width, height: full.height },
      THUMBNAIL_MAX_EDGE,
      THUMBNAIL_QUALITY
    );
    rendered.push(thumbnail.file);

    const sizeBytes = full.file.size;
    const rejection = checkPhoto(PHOTO_MIME_TYPE, sizeBytes);
    if (rejection !== null || sizeBytes === null) {
      rendered.forEach((file) => deleteFile(file.uri));
      return fail({ kind: 'rejected', reason: rejection ?? 'EMPTY' });
    }

    const folder = `${EVIDENCE_ROOT}/${target.inspectionId}`;
    const photoPath = `${folder}/${target.evidenceId}.jpg`;
    const thumbnailPath = `${folder}/${target.evidenceId}-thumb.jpg`;
    new Directory(Paths.document, folder).create({ intermediates: true, idempotent: true });
    full.file.move(new File(Paths.document, photoPath));
    thumbnail.file.move(new File(Paths.document, thumbnailPath));

    return ok({ photoPath, thumbnailPath, mimeType: PHOTO_MIME_TYPE, sizeBytes });
  } catch {
    rendered.forEach((file) => deleteFile(file.uri));
    return fail({ kind: 'storage' });
  }
}
