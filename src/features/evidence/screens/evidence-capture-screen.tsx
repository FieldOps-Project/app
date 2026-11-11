import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/design-system/components/button';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useReturnToChecklist } from '@/features/checklist/hooks/use-return-to-checklist';
import { CameraConsent } from '@/features/evidence/components/camera-consent';
import { EvidenceItemLink } from '@/features/evidence/components/evidence-item-link';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';

export function EvidenceCaptureScreen() {
  const inspectionId = useInspectionId();
  const { itemId = '' } = useLocalSearchParams<{ itemId?: string }>();
  const router = useRouter();
  const returnToChecklist = useReturnToChecklist(inspectionId);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const busy = useRef(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (permission === null) {
    return <Loading label="Verificando a câmera..." />;
  }

  if (!permission.granted) {
    return (
      <Screen scrollable edges={BELOW_HEADER_EDGES}>
        <EvidenceItemLink inspectionId={inspectionId} itemId={itemId} />
        <CameraConsent
          permission={permission}
          onRequest={() => void requestPermission()}
          onBack={returnToChecklist}
        />
      </Screen>
    );
  }

  async function capture() {
    if (camera.current === null || busy.current) {
      return;
    }
    busy.current = true;
    setCapturing(true);
    setFailure(null);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      router.replace({
        pathname: '/evidence/preview',
        params: {
          inspectionId,
          itemId,
          photoUri: picture.uri,
          width: String(picture.width),
          height: String(picture.height),
        },
      });
    } catch {
      setFailure('Não foi possível tirar a foto. Tente de novo.');
      busy.current = false;
      setCapturing(false);
    }
  }

  return (
    <Screen edges={BELOW_HEADER_EDGES}>
      <EvidenceItemLink inspectionId={inspectionId} itemId={itemId} />
      <View className="flex-1 overflow-hidden rounded-card bg-neutral-950">
        <CameraView
          ref={camera}
          style={{ flex: 1 }}
          facing="back"
          onCameraReady={() => setReady(true)}
          onMountError={() => setFailure('A câmera não abriu. Volte e tente de novo.')}
        />
      </View>
      {failure === null ? null : (
        <Text variant="body" tone="danger">
          {failure}
        </Text>
      )}
      <Button
        label="Fotografar"
        loading={capturing}
        disabled={!ready}
        onPress={() => void capture()}
      />
      <Button label="Cancelar" variant="secondary" onPress={returnToChecklist} />
    </Screen>
  );
}
