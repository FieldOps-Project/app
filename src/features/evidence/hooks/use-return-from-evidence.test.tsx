import { useReturnFromEvidence } from '@/features/evidence/hooks/use-return-from-evidence';
import { render } from '@/testing/render';

const mockRouter = { canDismiss: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() };
const mockReturnToChecklist = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/checklist/hooks/use-return-to-checklist', () => ({
  useReturnToChecklist: () => mockReturnToChecklist,
}));

const LIST = {
  pathname: '/inspections/[inspectionId]/non-conformities',
  params: { inspectionId: 'insp-1' },
};

function returnFrom(nonConformityId: string) {
  let back: () => void = () => undefined;
  function Probe() {
    back = useReturnFromEvidence('insp-1', nonConformityId);
    return null;
  }
  render(<Probe />);
  back();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canDismiss.mockReturnValue(false);
});

describe('useReturnFromEvidence', () => {
  it('goes back to the checklist when the photo belongs to an item', () => {
    returnFrom('');

    expect(mockReturnToChecklist).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('dismisses back to the non-conformities when they are already in the stack', () => {
    mockRouter.canDismiss.mockReturnValue(true);

    returnFrom('nc-1');

    expect(mockRouter.dismissTo).toHaveBeenCalledWith(LIST);
    expect(mockReturnToChecklist).not.toHaveBeenCalled();
  });

  it('opens the non-conformities when there is nothing to dismiss to', () => {
    returnFrom('nc-1');

    expect(mockRouter.replace).toHaveBeenCalledWith(LIST);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });
});
