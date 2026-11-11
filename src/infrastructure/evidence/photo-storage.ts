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

/** What the camera returns: a file in the cache, which the system may clear at any time. */
export interface CapturedPhoto {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export interface StoredPhoto {
  readonly photoUri: string;
  readonly thumbnailUri: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export type StorePhotoFailure =
  { readonly kind: 'rejected'; readonly reason: PhotoRejection } | { readonly kind: 'storage' };

/**
 * Evidence files live in the app's document directory, which the system never
 * clears on its own (RN-047), one folder per inspection.
 */
function inspectionDirectory(inspectionId: string): Directory {
  return new Directory(Paths.document, 'evidences', inspectionId);
}

async function render(photo: CapturedPhoto, maxEdge: number, quality: number): Promise<File> {
  const context = ImageManipulator.manipulate(photo.uri);
  try {
    const size = fitWithin(photo.width, photo.height, maxEdge);
    if (size !== null) {
      context.resize(size);
    }
    const image = await context.renderAsync();
    try {
      const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
      return new File(saved.uri);
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

/** Removes a file if it is there; a file already gone is not an error. */
export function deleteFile(uri: string | null): void {
  if (uri === null) {
    return;
  }
  try {
    const file = new File(uri);
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
 * cache into the persistent directory, with its thumbnail beside it. Nothing
 * is left behind on failure. The camera's own file is left alone, so a failed
 * attempt can be retried; the caller removes it once the evidence is saved.
 */
export async function storePhoto(
  photo: CapturedPhoto,
  target: { readonly inspectionId: string; readonly evidenceId: string }
): Promise<Result<StoredPhoto, StorePhotoFailure>> {
  const rendered: File[] = [];
  try {
    const full = await render(photo, PHOTO_MAX_EDGE, PHOTO_QUALITY);
    rendered.push(full);
    const thumbnail = await render(photo, THUMBNAIL_MAX_EDGE, THUMBNAIL_QUALITY);
    rendered.push(thumbnail);

    const sizeBytes = full.size;
    const rejection = checkPhoto(PHOTO_MIME_TYPE, sizeBytes);
    if (rejection !== null || sizeBytes === null) {
      rendered.forEach((file) => deleteFile(file.uri));
      return fail({ kind: 'rejected', reason: rejection ?? 'EMPTY' });
    }

    const directory = inspectionDirectory(target.inspectionId);
    directory.create({ intermediates: true, idempotent: true });
    const photoFile = new File(directory, `${target.evidenceId}.jpg`);
    const thumbnailFile = new File(directory, `${target.evidenceId}-thumb.jpg`);
    full.move(photoFile);
    thumbnail.move(thumbnailFile);

    return ok({
      photoUri: full.uri,
      thumbnailUri: thumbnail.uri,
      mimeType: PHOTO_MIME_TYPE,
      sizeBytes,
    });
  } catch {
    rendered.forEach((file) => deleteFile(file.uri));
    return fail({ kind: 'storage' });
  }
}
