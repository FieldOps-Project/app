import type { SyncState } from '@/domain/inspection';

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_QUALITY = 0.7;
export const THUMBNAIL_MAX_EDGE = 320;
export const THUMBNAIL_QUALITY = 0.6;

export const ACCEPTED_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png'];
export const PHOTO_MIME_TYPE = 'image/jpeg';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_DESCRIPTION_MAX = 500;

export interface EvidenceSummary {
  readonly id: string;
  readonly inspectionItemId: string | null;
  readonly photoPath: string | null;
  readonly thumbnailPath: string | null;
  readonly description: string | null;
  readonly createdAtDevice: string;
  readonly syncState: SyncState;
}

export type EvidenceUploadState = 'sent' | 'waiting' | 'failed';

export function evidenceUploadState(syncState: SyncState): EvidenceUploadState {
  switch (syncState) {
    case 'enviado':
      return 'sent';
    case 'falha':
    case 'conflito':
      return 'failed';
    case 'aguardando-envio':
    case 'salvo-no-dispositivo':
      return 'waiting';
  }
}

export type PhotoRejection = 'UNSUPPORTED_TYPE' | 'TOO_LARGE' | 'EMPTY';

export function checkPhoto(mimeType: string, sizeBytes: number | null): PhotoRejection | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(mimeType)) {
    return 'UNSUPPORTED_TYPE';
  }
  if (sizeBytes === null || sizeBytes <= 0) {
    return 'EMPTY';
  }
  return sizeBytes > PHOTO_MAX_BYTES ? 'TOO_LARGE' : null;
}

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

export function normalizeDescription(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed.slice(0, EVIDENCE_DESCRIPTION_MAX);
}
