import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import { useCompleteInspection } from '@/application/inspections/use-execution-actions';
import { captureLocation } from '@/infrastructure/location/capture-location';
import {
  checkCompletable,
  completeInspection,
} from '@/infrastructure/repositories/inspection-repository';
import { InspectionIncompleteError } from '@/infrastructure/repositories/inspection-errors';

jest.mock('@/config/env', () => ({ env: { apiUrl: 'http://api.test', appEnv: 'local' } }));
jest.mock('@/application/session/session-context', () => ({
  useSession: () => ({ session: { userId: 'u-1' } }),
}));
jest.mock('@/infrastructure/location/capture-location');
jest.mock('@/infrastructure/repositories/inspection-repository');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let complete: ReturnType<typeof useCompleteInspection>;
let renderer: ReactTestRenderer | undefined;

function Probe() {
  const value = useCompleteInspection('insp-1');
  useEffect(() => {
    complete = value;
  });
  return null;
}

beforeEach(async () => {
  jest.resetAllMocks();
  jest
    .mocked(captureLocation)
    .mockResolvedValue({ status: 'missing', reason: 'PERMISSION_DENIED' });
  await act(async () => {
    renderer = create(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>
    );
  });
});

afterEach(() => {
  act(() => renderer?.unmount());
});

describe('useCompleteInspection', () => {
  it('does not wait for the GPS when the checklist cannot be completed', async () => {
    jest.mocked(checkCompletable).mockRejectedValue(new InspectionIncompleteError());

    await act(async () => {
      await complete.mutateAsync().catch(() => undefined);
    });

    expect(captureLocation).not.toHaveBeenCalled();
    expect(completeInspection).not.toHaveBeenCalled();
  });

  it('captures the location and completes once the checklist is ready', async () => {
    jest.mocked(checkCompletable).mockResolvedValue(undefined);

    await act(async () => {
      await complete.mutateAsync();
    });

    expect(captureLocation).toHaveBeenCalledTimes(1);
    expect(completeInspection).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUserId: 'u-1', inspectionId: 'insp-1' })
    );
  });
});
