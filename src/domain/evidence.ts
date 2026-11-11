import type { SyncState } from '@/domain/inspection';

/**
 * Photo evidences (card #17, UC-11, document 13.10).
 *
 * A 12 MP photo weighs several megabytes; twenty of them would make the sync
 * impossible on a mobile network. The photo is resized so its longest edge is
 * at most `PHOTO_MAX_EDGE` and compressed as JPEG, which keeps it readable as
 * evidence. A small thumbnail is saved next to it, so lists never decode the
 * full picture.
 */
export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.7;
export const THUMBNAIL_MAX_EDGE = 320;
export const THUMBNAIL_QUALITY = 0.6;

/** RN-046: the formats backend#22 accepts (image/jpeg, image/png). The app always writes JPEG. */
export const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
export const PHOTO_MIME_TYPE = 'image/jpeg';
/** RN-046: far above a compressed 1600 px photo, so only a broken file hits it. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_DESCRIPTION_MAX = 500;

/** One evidence as the checklist shows it. */
export interface EvidenceSummary {
  readonly id: string;
  readonly inspectionItemId: string | null;
  /** Full resolution, opened only when the technician enlarges the photo. */
  readonly photoUri: string | null;
  readonly thumbnailUri: string | null;
  readonly description: string | null;
  readonly createdAtDevice: string;
  readonly syncState: SyncState;
}

export type PhotoRejection = 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'EMPTY';

/** RN-046, checked on the device before the photo becomes an evidence. */
export function checkPhoto(mimeType: string, sizeBytes: number | null): PhotoRejection | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(mimeType)) {
    return 'UNSUPPORTED_TYPE';
  }
  if (sizeBytes === null || sizeBytes <= 0) {
    return 'EMPTY';
  }
  return sizeBytes > PHOTO_MAX_BYTES ? 'TOO_LARGE' : null;
}

/**
 * The size that fits the longest edge within `maxEdge`, keeping the ratio.
 * `null` when the picture already fits: a photo is never enlarged.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= maxEdge) {
    return null;
  }
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/** An optional description: trimmed, and empty means none. */
export function normalizeDescription(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed.slice(0, EVIDENCE_DESCRIPTION_MAX);
}
