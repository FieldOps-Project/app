import { fail, ok, type Result } from '@/domain/result';
import type { ApiFailure, MobileInspectionsGateway } from '@/infrastructure/api';
import {
  findServerUpdates,
  saveDownloadedInspection,
} from '@/infrastructure/repositories/inspection-repository';

export interface RefreshOutcome {
  /** Inspections written to the device in this run. */
  readonly saved: number;
  /** Inspections whose download failed; what was stored before stays as it was. */
  readonly failed: number;
}

/**
 * Downloads the technician's inspections into SQLite (document 10.14.1).
 *
 * The device is the source the screens read, so a failure here never removes
 * anything: the list fails as a whole and the stored inspections remain, or a
 * single detail fails and only that inspection keeps its previous version
 * (UC-07). An inspection whose `updatedAt` matches what is stored is skipped,
 * which keeps a routine refresh to one request.
 *
 * The incremental cursor and paging by batches arrive with card #22.
 */
export async function refreshInspections(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string = () => new Date().toISOString()
): Promise<Result<RefreshOutcome, ApiFailure>> {
  const listed = await gateway.list();
  if (!listed.ok) {
    return listed;
  }

  const stored = await findServerUpdates(ownerUserId);
  let saved = 0;
  let failed = 0;
  let lastFailure: ApiFailure | null = null;

  for (const entry of listed.value) {
    const known = stored.get(entry.id);
    if (entry.updatedAt !== null && known === entry.updatedAt) {
      continue;
    }

    const detail = await gateway.detail(entry.id);
    if (!detail.ok) {
      if (detail.error.kind === 'network') {
        return fail(detail.error);
      }
      failed += 1;
      lastFailure = detail.error;
      continue;
    }

    await saveDownloadedInspection(ownerUserId, detail.value, now());
    saved += 1;
  }

  if (saved === 0 && lastFailure !== null) {
    return fail(lastFailure);
  }
  return ok({ saved, failed });
}
