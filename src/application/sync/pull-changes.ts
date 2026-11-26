import { fail, ok, type Result } from '@/domain/result';
import type { ApiFailure, MobileInspectionsGateway } from '@/infrastructure/api';
import { applyPulledPage, readPullCursor } from '@/infrastructure/repositories/pull-repository';

const MAX_PAGES = 100;

export interface PullOutcome {
  readonly applied: number;
  readonly conflicts: number;
  readonly held: boolean;
}

export async function pullChanges(
  ownerUserId: string,
  gateway: MobileInspectionsGateway,
  now: () => string = () => new Date().toISOString()
): Promise<Result<PullOutcome, ApiFailure>> {
  let cursor = await readPullCursor(ownerUserId);
  let applied = 0;
  let conflicts = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const received = await gateway.pull(cursor);
    if (!received.ok) {
      return fail(received.error);
    }

    const outcome = await applyPulledPage(
      ownerUserId,
      received.value.changes,
      received.value.nextCursor,
      now()
    );
    applied += outcome.applied;
    conflicts += outcome.conflicts;

    if (outcome.unresolved > 0) {
      return ok({ applied, conflicts, held: true });
    }
    cursor = received.value.nextCursor ?? cursor;
    if (!received.value.hasMore || received.value.nextCursor === null) {
      break;
    }
  }

  return ok({ applied, conflicts, held: false });
}
