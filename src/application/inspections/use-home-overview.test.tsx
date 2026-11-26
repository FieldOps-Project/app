import { act } from 'react';

import { useHomeRefresh } from '@/application/inspections/use-home-overview';
import { render } from '@/testing/render';

const mockDownload = { isFetching: false, refetch: jest.fn() };
const mockSummaries = { data: [], isError: false, refetch: jest.fn() };
const mockPending = { data: 0, isError: false, refetch: jest.fn() };

jest.mock('@/application/sync/use-synchronization', () => ({
  useInspectionsDownload: () => mockDownload,
}));
jest.mock('@/application/inspections/use-inspections', () => ({
  useInspectionSummaries: () => mockSummaries,
  usePendingOperationsCount: () => mockPending,
}));

type Seen = ReturnType<typeof useHomeRefresh>;

function mountProbe(): { current: () => Seen } {
  let latest: Seen | undefined;
  function Probe({ onRender }: { onRender: (value: Seen) => void }) {
    onRender(useHomeRefresh());
    return null;
  }
  render(
    <Probe
      onRender={(value) => {
        latest = value;
      }}
    />
  );
  return {
    current: () => {
      if (latest === undefined) {
        throw new Error('O hook não renderizou.');
      }
      return latest;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDownload.isFetching = false;
});

describe('useHomeRefresh', () => {
  it('downloads from the server and rereads the local metrics, so it works offline too', () => {
    const probe = mountProbe();

    act(() => probe.current().refresh());

    expect(mockDownload.refetch).toHaveBeenCalledTimes(1);
    expect(mockSummaries.refetch).toHaveBeenCalledTimes(1);
    expect(mockPending.refetch).toHaveBeenCalledTimes(1);
  });

  it('reports the download as the refreshing state', () => {
    mockDownload.isFetching = true;

    const probe = mountProbe();

    expect(probe.current().refreshing).toBe(true);
  });
});
