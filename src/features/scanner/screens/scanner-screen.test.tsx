import { act } from 'react';
import { Alert } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import type { EquipmentIdentification } from '@/domain/equipment-identification';
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
const mockIdentify: {
  current: { isPending: boolean; data: EquipmentIdentification | undefined };
} = { current: { isPending: false, data: undefined } };
const mockDetail: { current: InspectionDetailState } = { current: { state: 'not-found' } };

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
  useIsFocused: () => mockFocused.current,
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
  mockIdentify.current = { isPending: false, data: undefined };
  mockDetail.current = { state: 'not-found' };
});

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
    expect(mockMutate).toHaveBeenCalledWith('EQP-001');
  });

  it('starts a new cycle when the technician reads again', () => {
    mockIdentify.current = { isPending: false, data: { kind: 'not-found', offline: false } };
    const screen = render();
    camera(screen);

    press(screen, 'Ler novamente');
    mockIdentify.current = { isPending: false, data: undefined };
    act(() => screen.update(<ScannerScreen />));
    act(() => camera(screen)?.props.onBarcodeScanned({ data: 'EQP-002' }));

    expect(mockReset).toHaveBeenCalled();
    expect(mockMutate).toHaveBeenCalledWith('EQP-002');
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
    expect(mockMutate).toHaveBeenCalledWith('PAT-1');
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
    mockIdentify.current = { isPending: false, data: { kind: 'not-found', offline: true } };

    const screen = render();

    expect(texts(screen)).toContain('Equipamento não localizado');
    expect(texts(screen)).toContain('sem conexão');
  });

  it('shows both equipments on a divergence and goes on only after an explicit confirmation', () => {
    mockParams.current = { inspectionId: 'insp-1' };
    mockDetail.current = {
      state: 'ready',
      detail: { id: 'insp-1', equipment: COMPRESSOR } as unknown as InspectionDetail,
    } as InspectionDetailState;
    mockIdentify.current = {
      isPending: false,
      data: {
        kind: 'divergent',
        expected: COMPRESSOR,
        read: { equipment: GENERATOR, inspections: [] },
      },
    };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const screen = render();
    press(screen, 'Seguir com o equipamento previsto');

    expect(texts(screen)).toContain('Compressor 01');
    expect(texts(screen)).toContain('Gerador 02');
    expect(mockBack).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    act(() => buttons.find((entry) => entry.text === 'Estou no equipamento previsto')?.onPress?.());
    expect(mockBack).toHaveBeenCalled();
  });

  it('opens one of the equipment inspections', () => {
    mockIdentify.current = {
      isPending: false,
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
