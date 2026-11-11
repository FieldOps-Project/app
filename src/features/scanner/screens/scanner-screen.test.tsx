import { act } from 'react';
import { Alert } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import {
  EQUIPMENT_CODE_MAX,
  type EquipmentIdentification,
} from '@/domain/equipment-identification';
import type { InspectionDetail, InspectionEquipment } from '@/domain/inspection';
import { ScannerScreen } from '@/features/scanner/screens/scanner-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockParams: { current: Record<string, string> } = { current: {} };
const mockFocused = { current: true };
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPermission: { current: unknown } = { current: null };
const mockMutate = jest.fn();
const mockReset = jest.fn();
const IDLE = {
  isPending: false,
  isError: false,
  data: undefined as EquipmentIdentification | undefined,
};
const mockIdentify: { current: typeof IDLE } = { current: IDLE };
const mockDetail: { current: InspectionDetailState } = { current: { state: 'not-found' } };
const mockDispatch = jest.fn();
type LeaveCallback = (options: { data: { action: { type: string } } }) => void;
const mockLeaveGuard: { active: boolean; onLeave: LeaveCallback | null } = {
  active: false,
  onLeave: null,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useIsFocused: () => mockFocused.current,
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (active: boolean, onLeave: LeaveCallback) => {
    mockLeaveGuard.active = active;
    mockLeaveGuard.onLeave = onLeave;
  },
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [mockPermission.current, jest.fn()],
}));
jest.mock('@/application/inspections/use-inspection-detail', () => ({
  useInspectionDetail: () => mockDetail.current,
}));
jest.mock('@/application/equipment/identify-equipment', () => ({
  useIdentifyEquipment: () => ({
    mutate: mockMutate,
    reset: mockReset,
    ...mockIdentify.current,
  }),
}));

const COMPRESSOR: InspectionEquipment = {
  id: 'eq-1',
  name: 'Compressor 01',
  qrCode: 'EQP-001',
  assetNumber: 'PAT-1',
  serialNumber: null,
};
const GENERATOR: InspectionEquipment = { ...COMPRESSOR, id: 'eq-2', name: 'Gerador 02' };

const GRANTED = { granted: true, status: 'granted', canAskAgain: true };

function render(): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(<ScannerScreen />);
  });
  return renderer!;
}

function texts(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

function camera(renderer: ReactTestRenderer) {
  return renderer.root.findAll(
    (node) => typeof node.props.onBarcodeScanned === 'function' && node.props.facing === 'back'
  )[0];
}

function press(renderer: ReactTestRenderer, label: string) {
  const button = renderer.root.findAllByType(Button).find((entry) => entry.props.label === label);
  if (button === undefined) {
    throw new Error(`No button "${label}"`);
  }
  act(() => button.props.onPress());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  mockFocused.current = true;
  mockPermission.current = GRANTED;
  mockIdentify.current = IDLE;
  mockDetail.current = { state: 'not-found' };
  mockLeaveGuard.active = false;
  mockLeaveGuard.onLeave = null;
});

const DIVERGENT: EquipmentIdentification = {
  kind: 'divergent',
  expected: COMPRESSOR,
  scanned: {
    equipment: GENERATOR,
    inspections: [
      {
        id: 'insp-9',
        title: 'Corretiva',
        status: 'ASSIGNED',
        scheduledFor: '2026-08-12T13:00:00Z',
      },
    ],
  },
};

function showDivergence() {
  mockParams.current = { inspectionId: 'insp-1' };
  mockDetail.current = {
    state: 'ready',
    detail: { id: 'insp-1', equipment: COMPRESSOR } as unknown as InspectionDetail,
  } as InspectionDetailState;
  mockIdentify.current = { ...IDLE, data: DIVERGENT };
  return render();
}

function leave() {
  const action = { type: 'GO_BACK' };
  act(() => mockLeaveGuard.onLeave?.({ data: { action } }));
  return action;
}

describe('scanner', () => {
  it('handles a code once per reading cycle, however often the camera reports it', () => {
    const screen = render();
    const view = camera(screen);

    act(() => {
      view?.props.onBarcodeScanned({ data: 'EQP-001' });
      view?.props.onBarcodeScanned({ data: 'EQP-001' });
      view?.props.onBarcodeScanned({ data: 'EQP-001' });
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ code: 'EQP-001', source: 'camera' });
  });

  it('answers every code the camera reads, even one that cannot be an equipment code', () => {
    const screen = render();
    const huge = 'x'.repeat(EQUIPMENT_CODE_MAX + 1);

    act(() => {
      camera(screen)?.props.onBarcodeScanned({ data: huge });
      camera(screen)?.props.onBarcodeScanned({ data: huge });
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ code: huge, source: 'camera' });
  });

  it('starts a new cycle only when the technician reads again', () => {
    const screen = render();
    act(() => camera(screen)?.props.onBarcodeScanned({ data: 'EQP-001' }));
    mockIdentify.current = { ...IDLE, data: { kind: 'not-found', server: 'answered' } };
    act(() => screen.update(<ScannerScreen />));

    press(screen, 'Ler novamente');
    mockIdentify.current = IDLE;
    act(() => screen.update(<ScannerScreen />));
    act(() => camera(screen)?.props.onBarcodeScanned({ data: 'EQP-002' }));

    expect(mockReset).toHaveBeenCalled();
    expect(mockMutate).toHaveBeenNthCalledWith(1, { code: 'EQP-001', source: 'camera' });
    expect(mockMutate).toHaveBeenNthCalledWith(2, { code: 'EQP-002', source: 'camera' });
  });

  it('keeps the scanner usable after a lookup that failed on the device', () => {
    const screen = render();
    act(() => camera(screen)?.props.onBarcodeScanned({ data: 'EQP-001' }));
    mockIdentify.current = { ...IDLE, isError: true };
    act(() => screen.update(<ScannerScreen />));

    press(screen, 'Tentar de novo');
    mockIdentify.current = IDLE;
    act(() => screen.update(<ScannerScreen />));
    act(() => camera(screen)?.props.onBarcodeScanned({ data: 'EQP-001' }));

    expect(mockMutate).toHaveBeenCalledTimes(2);
  });

  it('never compares against nothing when the inspection cannot be opened', () => {
    mockParams.current = { inspectionId: 'insp-1' };
    mockDetail.current = { state: 'not-found' };

    const screen = render();

    expect(camera(screen)).toBeUndefined();
    expect(texts(screen)).toContain('Inspeção indisponível');
  });

  it('turns the camera off when the screen is left', () => {
    mockFocused.current = false;

    const screen = render();

    expect(camera(screen)).toBeUndefined();
  });

  it('offers manual identification when the camera is refused', () => {
    mockPermission.current = { granted: false, status: 'denied', canAskAgain: false };
    const screen = render();

    act(() => screen.root.findByType(Input).props.onChangeText('  PAT-1 '));
    press(screen, 'Buscar equipamento');

    expect(texts(screen)).toContain('Permitir nas configurações');
    expect(camera(screen)).toBeUndefined();
    expect(mockMutate).toHaveBeenCalledWith({ code: '  PAT-1 ', source: 'manual' });
  });

  it('keeps what the technician types exactly as typed', () => {
    mockPermission.current = { granted: false, status: 'denied', canAskAgain: false };
    const screen = render();

    expect(screen.root.findByType(Input).props.autoCapitalize).toBe('none');
  });

  it('waits for the inspection before comparing what is read with what it expects', () => {
    mockParams.current = { inspectionId: 'insp-1' };
    mockDetail.current = { state: 'loading' };

    const screen = render();

    expect(camera(screen)).toBeUndefined();
    expect(texts(screen)).toContain('Carregando a inspeção');
  });
});

describe('result', () => {
  it('says clearly when the equipment is unknown, and why the server was not asked', () => {
    mockIdentify.current = { ...IDLE, data: { kind: 'not-found', server: 'offline' } };

    const screen = render();

    expect(texts(screen)).toContain('Equipamento não localizado');
    expect(texts(screen)).toContain('sem conexão');
  });

  it('shows both equipments on a divergence and leaves only after an explicit confirmation', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = showDivergence();

    press(screen, 'Seguir com o equipamento previsto');
    const action = leave();

    expect(texts(screen)).toContain('Compressor 01');
    expect(texts(screen)).toContain('Gerador 02');
    expect(mockLeaveGuard.active).toBe(true);
    expect(mockBack).toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    act(() => buttons.find((entry) => entry.text === 'Estou no equipamento previsto')?.onPress?.());
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });

  it('asks the same confirmation when the technician leaves by the back button', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    showDivergence();

    leave();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    act(() => buttons.find((entry) => entry.text === 'Cancelar')?.onPress?.());

    expect(alert).toHaveBeenCalledWith(
      'Seguir mesmo assim?',
      expect.any(String),
      expect.any(Array)
    );
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('opens an inspection of the scanned equipment without asking about the expected one', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = showDivergence();

    const link = screen.root.findAll(
      (node) => node.props.accessibilityLabel === 'Abrir Corretiva' && node.props.onPress
    )[0];
    act(() => link?.props.onPress());
    const action = leave();

    expect(mockReplace).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });

  it('lets the technician leave freely when there is no divergence', () => {
    mockIdentify.current = { ...IDLE, data: { kind: 'not-found', server: 'answered' } };
    render();

    expect(mockLeaveGuard.active).toBe(false);
  });

  it('opens one of the equipment inspections', () => {
    mockIdentify.current = {
      ...IDLE,
      data: {
        kind: 'found',
        match: {
          equipment: COMPRESSOR,
          inspections: [
            {
              id: 'insp-7',
              title: 'Preventiva',
              status: 'ASSIGNED',
              scheduledFor: '2026-08-12T13:00:00Z',
            },
          ],
        },
      },
    };
    const screen = render();

    const link = screen.root.findAll(
      (node) => node.props.accessibilityLabel === 'Abrir Preventiva' && node.props.onPress
    )[0];
    act(() => link?.props.onPress());

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/inspections/[inspectionId]',
      params: { inspectionId: 'insp-7' },
    });
  });
});
