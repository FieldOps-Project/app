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

export interface CapturedPhoto {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

export interface StoredPhoto {
  readonly photoPath: string;
  readonly thumbnailPath: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export type StorePhotoFailure =
  { readonly kind: 'rejected'; readonly reason: PhotoRejection } | { readonly kind: 'storage' };

const EVIDENCE_ROOT = 'evidences';

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

export function deleteFile(path: string | null): void {
  if (path === null) {
    return;
  }
  try {
    const file = new File(evidenceFileUri(path));
    if (file.exists) {
      file.delete();
    }
  } catch {}
}

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
