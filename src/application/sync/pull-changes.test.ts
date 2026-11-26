import { pullChanges } from '@/application/sync/pull-changes';
import { fail, ok } from '@/domain/result';
import type { MobileInspectionsGateway } from '@/infrastructure/api';
import { applyPulledPage, readPullCursor } from '@/infrastructure/repositories/pull-repository';
import type { SyncPull } from '@/schemas/sync-pull';

jest.mock('@/infrastructure/repositories/pull-repository');

const NOW = () => '2026-08-12T13:00:00.000Z';

function page(nextCursor: string | null, hasMore: boolean): SyncPull {
  return { changes: [], nextCursor, hasMore };
}

function gatewayReturning(...pages: SyncPull[]) {
  const pull = jest.fn();
  pages.forEach((entry) => pull.mockResolvedValueOnce(ok(entry)));
  return { pull } as unknown as MobileInspectionsGateway & { pull: jest.Mock };
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(readPullCursor).mockResolvedValue(null);
  jest
    .mocked(applyPulledPage)
    .mockResolvedValue({ applied: 1, conflicts: 0, unresolved: 0, cursorAdvanced: true });
});

describe('pullChanges', () => {
  it('starts from the stored cursor and follows every page, saving each before asking for the next', async () => {
    jest.mocked(readPullCursor).mockResolvedValue('stored');
    const gateway = gatewayReturning(page('c1', true), page('c2', false));

    const result = await pullChanges('u-1', gateway, NOW);

    expect(gateway.pull.mock.calls.map(([cursor]) => cursor)).toEqual(['stored', 'c1']);
    expect(applyPulledPage).toHaveBeenCalledTimes(2);
    expect(result).toEqual(ok({ applied: 2, conflicts: 0, held: false }));
  });

  it('stops at the page whose answers could not be stored and keeps the cursor there', async () => {
    jest
      .mocked(applyPulledPage)
      .mockResolvedValue({ applied: 0, conflicts: 0, unresolved: 1, cursorAdvanced: false });
    const gateway = gatewayReturning(page('c1', true), page('c2', false));

    const result = await pullChanges('u-1', gateway, NOW);

    expect(gateway.pull).toHaveBeenCalledTimes(1);
    expect(result).toEqual(ok({ applied: 0, conflicts: 0, held: true }));
  });

  it('adds up the conflicts found along the way', async () => {
    jest
      .mocked(applyPulledPage)
      .mockResolvedValue({ applied: 0, conflicts: 2, unresolved: 0, cursorAdvanced: true });
    const gateway = gatewayReturning(page('c1', true), page('c2', false));

    const result = await pullChanges('u-1', gateway, NOW);

    expect(result).toEqual(ok({ applied: 0, conflicts: 4, held: false }));
  });

  it('does not loop when the server says there is more but sends no cursor', async () => {
    const gateway = gatewayReturning(page(null, true), page('c2', false));

    await pullChanges('u-1', gateway, NOW);

    expect(gateway.pull).toHaveBeenCalledTimes(1);
  });

  it('reports a failed page without applying anything for it', async () => {
    const gateway = { pull: jest.fn().mockResolvedValue(fail({ kind: 'server' })) } as never;

    const result = await pullChanges('u-1', gateway, NOW);

    expect(result).toEqual(fail({ kind: 'server' }));
    expect(applyPulledPage).not.toHaveBeenCalled();
  });

  it('keeps what earlier pages brought when a later page fails', async () => {
    const pull = jest
      .fn()
      .mockResolvedValueOnce(ok(page('c1', true)))
      .mockResolvedValueOnce(fail({ kind: 'network' }));

    const result = await pullChanges('u-1', { pull } as never, NOW);

    expect(result).toEqual(fail({ kind: 'network' }));
    expect(applyPulledPage).toHaveBeenCalledTimes(1);
  });
});
