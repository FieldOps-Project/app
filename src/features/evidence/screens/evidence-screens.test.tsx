import { act } from 'react';
import { Image, Linking } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';

import type { InspectionDetailState } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import type { ChecklistItem } from '@/domain/checklist';
import type { EvidenceSummary } from '@/domain/evidence';
import type { InspectionDetail } from '@/domain/inspection';
import { ChecklistItemRow } from '@/features/checklist/components/checklist-item-row';
import { EvidenceCaptureScreen } from '@/features/evidence/screens/evidence-capture-screen';
import { EvidencePreviewScreen } from '@/features/evidence/screens/evidence-preview-screen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const mockParams: { current: Record<string, string> } = { current: {} };
const mockReplace = jest.fn();
const mockReturn = jest.fn();
const mockAttach = jest.fn();
const mockAttachState: { current: { isPending: boolean; error: Error | null } } = {
  current: { isPending: false, error: null },
};
const mockRequest = jest.fn();
const mockPermission: { current: unknown } = { current: null };
const mockDelete = jest.fn();
const mockDetail: { current: InspectionDetailState } = { current: { state: 'loading' } };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ inspectionId: 'insp-1', ...mockParams.current }),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [mockPermission.current, mockRequest],
}));
jest.mock('@/features/checklist/hooks/use-return-to-checklist', () => ({
  useReturnToChecklist: () => mockReturn,
}));
jest.mock('@/application/inspections/use-inspection-detail', () => ({
  useInspectionDetail: () => mockDetail.current,
}));
jest.mock('@/application/inspections/use-checklist-actions', () => ({
  useAttachPhoto: () => ({ mutate: mockAttach, ...mockAttachState.current }),
}));
jest.mock('@/application/evidence/evidence-files', () => ({
  evidenceImageUri: (path: string) => `file:///documents/${path}`,
  discardCapturedPhoto: (uri: string) => mockDelete(uri),
}));

const ITEM: ChecklistItem = {
  id: 'item-1',
  sectionTitle: 'Estrutura',
  sectionDescription: null,
  sectionOrder: 1,
  itemCode: 'E-01',
  itemTitle: 'Proteção lateral',
  itemDescription: null,
  responseType: 'CONFORMITY',
  required: true,
  rules: {
    observationRequiredOnFailure: false,
    evidenceRequiredOnFailure: true,
    min: null,
    max: null,
  },
  options: [],
  itemOrder: 1,
};

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(element);
  });
  return renderer!;
}

function texts(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
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
  mockParams.current = { itemId: 'item-1' };
  mockAttachState.current = { isPending: false, error: null };
  mockDetail.current = {
    state: 'ready',
    detail: { id: 'insp-1', status: 'IN_PROGRESS' } as InspectionDetail,
    items: [ITEM],
    responses: new Map(),
    evidenceCounts: new Map(),
    evidences: {},
    progress: {} as never,
  };
});

describe('capture', () => {
  it('explains the camera before asking for it and names the item', () => {
    mockPermission.current = { granted: false, status: 'undetermined', canAskAgain: true };

    const screen = render(<EvidenceCaptureScreen />);
    press(screen, 'Permitir câmera');

    expect(texts(screen)).toContain('A câmera é usada só para fotografar as evidências');
    expect(texts(screen)).toContain('E-01 · Proteção lateral');
    expect(mockRequest).toHaveBeenCalled();
  });

  it('keeps the inspection going when the camera is refused for good', () => {
    mockPermission.current = { granted: false, status: 'denied', canAskAgain: false };
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

    const screen = render(<EvidenceCaptureScreen />);
    press(screen, 'Permitir nas configurações');
    press(screen, 'Voltar ao checklist');

    expect(texts(screen)).toContain('A inspeção continua');
    expect(openSettings).toHaveBeenCalled();
    expect(mockReturn).toHaveBeenCalled();
  });

  it('shows the camera once allowed', () => {
    mockPermission.current = { granted: true, status: 'granted', canAskAgain: true };

    const screen = render(<EvidenceCaptureScreen />);

    const shoot = screen.root.findAllByType(Button).find((b) => b.props.label === 'Fotografar');
    expect(shoot?.props.disabled).toBe(true);
  });
});

describe('preview', () => {
  beforeEach(() => {
    mockParams.current = {
      itemId: 'item-1',
      photoUri: 'file:///cache/camera/photo.jpg',
      width: '4032',
      height: '3024',
    };
  });

  it('shows the photo with its item and saves it with the description', () => {
    const screen = render(<EvidencePreviewScreen />);
    const description = screen.root.findByType(Input);
    act(() => description.props.onChangeText('Trinca na base'));

    press(screen, 'Usar esta foto');

    expect(texts(screen)).toContain('Proteção lateral');
    expect(screen.root.findByType(Image).props.source).toEqual({
      uri: 'file:///cache/camera/photo.jpg',
    });
    expect(mockAttach).toHaveBeenCalledWith(
      {
        inspectionItemId: 'item-1',
        photo: { uri: 'file:///cache/camera/photo.jpg', width: 4032, height: 3024 },
        description: 'Trinca na base',
      },
      { onSuccess: mockReturn }
    );
  });

  it('throws the photo away and opens the camera again to retake it', () => {
    const screen = render(<EvidencePreviewScreen />);

    press(screen, 'Refazer');

    expect(mockDelete).toHaveBeenCalledWith('file:///cache/camera/photo.jpg');
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/evidence/capture',
      params: { inspectionId: 'insp-1', itemId: 'item-1' },
    });
  });

  it('discards the photo and goes back to the checklist', () => {
    const screen = render(<EvidencePreviewScreen />);

    press(screen, 'Descartar');

    expect(mockDelete).toHaveBeenCalledWith('file:///cache/camera/photo.jpg');
    expect(mockReturn).toHaveBeenCalled();
    expect(mockAttach).not.toHaveBeenCalled();
  });

  it('says why the photo could not be saved and keeps it for another try', () => {
    mockAttachState.current = { isPending: false, error: new Error('Sem espaço no aparelho.') };

    const screen = render(<EvidencePreviewScreen />);

    expect(texts(screen)).toContain('Sem espaço no aparelho.');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('sends the technician back when there is no photo to check', () => {
    mockParams.current = { itemId: 'item-1' };

    const screen = render(<EvidencePreviewScreen />);

    expect(texts(screen)).toContain('Nenhuma foto para conferir');
  });
});

describe('checklist row', () => {
  const evidence = (id: string, syncState: EvidenceSummary['syncState']): EvidenceSummary => ({
    id,
    inspectionItemId: 'item-1',
    photoPath: `evidences/insp-1/${id}.jpg`,
    thumbnailPath: `evidences/insp-1/${id}-thumb.jpg`,
    description: null,
    createdAtDevice: '2026-08-12T13:00:00.000Z',
    syncState,
  });

  function row(evidences: EvidenceSummary[], onOpenEvidence = jest.fn()) {
    return render(
      <ChecklistItemRow
        item={ITEM}
        response={undefined}
        evidences={evidences}
        needsObservation={false}
        needsEvidence={false}
        toCorrect={false}
        editable
        focused={false}
        onSave={jest.fn()}
        onCaptureEvidence={jest.fn()}
        onOpenEvidence={onOpenEvidence}
      />
    );
  }

  it('shows thumbnails only, and which photos wait or failed to be sent', () => {
    const screen = row([
      evidence('ev-1', 'enviado'),
      evidence('ev-2', 'aguardando-envio'),
      evidence('ev-3', 'falha'),
    ]);

    const sources = screen.root.findAllByType(Image).map((image) => image.props.source.uri);
    expect(sources).toEqual([
      'file:///documents/evidences/insp-1/ev-1-thumb.jpg',
      'file:///documents/evidences/insp-1/ev-2-thumb.jpg',
      'file:///documents/evidences/insp-1/ev-3-thumb.jpg',
    ]);
    expect(texts(screen)).toContain('1 aguardando envio');
    expect(texts(screen)).toContain('1 com falha no envio');
  });

  it('opens the photo it was pressed on', () => {
    const open = jest.fn();
    const screen = row([evidence('ev-1', 'aguardando-envio')], open);

    const thumbnail = screen.root.findAll(
      (node) => node.props.accessibilityRole === 'imagebutton' && node.props.onPress !== undefined
    )[0];
    act(() => thumbnail?.props.onPress());

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'ev-1' }));
  });

  it('keeps twenty photos as thumbnails', () => {
    const many = Array.from({ length: 20 }, (_, index) => evidence(`ev-${index}`, 'enviado'));

    const screen = row(many);

    const sources = screen.root.findAllByType(Image).map((image) => image.props.source.uri);
    expect(sources).toHaveLength(20);
    expect(sources.every((uri: string) => uri.endsWith('-thumb.jpg'))).toBe(true);
  });
});
