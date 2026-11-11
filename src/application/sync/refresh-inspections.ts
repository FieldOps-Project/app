import { fail, ok, type Result } from '@/domain/result';
import type { ApiFailure, MobileInspectionsGateway } from '@/infrastructure/api';
import {
  findServerUpdates,
  saveDownloadedInspection,
} from '@/infrastructure/repositories/inspection-repository';

export interface RefreshOutcome {
  readonly saved: number;
  readonly failed: number;
}

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
