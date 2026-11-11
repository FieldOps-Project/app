import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { useIdentifyEquipment } from '@/application/equipment/identify-equipment';
import { useInspectionDetail } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Input } from '@/design-system/components/input';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { EQUIPMENT_CODE_MAX, normalizeEquipmentCode } from '@/domain/equipment-identification';
import { IdentificationResult } from '@/features/scanner/components/identification-result';

export function ScannerScreen() {
  const { inspectionId } = useLocalSearchParams<{ inspectionId?: string }>();
  const router = useRouter();
  const isFocused = useIsFocused();
  const inspection = useInspectionDetail(inspectionId ?? '');
  const expected = inspection.state === 'ready' ? inspection.detail.equipment : null;
  const identify = useIdentifyEquipment(expected);
  const [permission, requestPermission] = useCameraPermissions();
  const [typing, setTyping] = useState(false);
  const accepted = useRef(false);

  function lookUp(raw: string) {
    const code = normalizeEquipmentCode(raw);
    if (code === null || accepted.current) {
      return;
    }
    accepted.current = true;
    identify.mutate(code);
  }

  function scanAgain() {
    accepted.current = false;
    identify.reset();
  }

  function openInspection(id: string) {
    router.replace({ pathname: '/inspections/[inspectionId]', params: { inspectionId: id } });
  }

  if (inspectionId !== undefined && inspectionId !== '' && inspection.state === 'loading') {
    return <Loading label="Carregando a inspeção..." />;
  }

  if (identify.isPending) {
    return <Loading label="Procurando o equipamento..." />;
  }

  if (identify.data !== undefined) {
    return (
      <Screen scrollable edges={BELOW_HEADER_EDGES}>
        <IdentificationResult
          result={identify.data}
          onScanAgain={scanAgain}
          onContinue={() => router.back()}
          onOpenInspection={openInspection}
        />
      </Screen>
    );
  }

  if (permission === null) {
    return <Loading label="Verificando a câmera..." />;
  }

  const cameraAvailable = permission.granted && !typing;

  return (
    <Screen scrollable={!cameraAvailable} edges={BELOW_HEADER_EDGES}>
      {expected === null ? null : (
        <Text variant="body" tone="muted">{`Equipamento previsto: ${expected.name}`}</Text>
      )}

      {cameraAvailable ? (
        <View className="flex-1 overflow-hidden rounded-card bg-neutral-950">
          {isFocused ? (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }: BarcodeScanningResult) => lookUp(data)}
            />
          ) : null}
        </View>
      ) : null}

      {!permission.granted ? (
        <ScannerConsent
          blocked={permission.status === 'denied' && !permission.canAskAgain}
          refused={permission.status === 'denied'}
          onRequest={() => void requestPermission()}
        />
      ) : null}

      {cameraAvailable ? (
        <>
          <Text variant="caption" tone="muted">
            Aponte a câmera para o QR Code da placa do equipamento.
          </Text>
          <Button label="Digitar o código" variant="secondary" onPress={() => setTyping(true)} />
        </>
      ) : (
        <ManualCodeForm onSubmit={lookUp} />
      )}

      {typing && permission.granted ? (
        <Button label="Usar a câmera" variant="secondary" onPress={() => setTyping(false)} />
      ) : null}
    </Screen>
  );
}

function ScannerConsent({
  blocked,
  refused,
  onRequest,
}: {
  blocked: boolean;
  refused: boolean;
  onRequest: () => void;
}) {
  return (
    <Card title="Câmera">
      <Text variant="body" tone={refused ? 'warning' : 'default'}>
        {refused
          ? 'A permissão da câmera está negada. Digite abaixo o código do QR ou o número de patrimônio da placa.'
          : 'A câmera é usada só para ler o QR Code do equipamento. Nada é gravado.'}
      </Text>
      {blocked ? (
        <Button
          label="Permitir nas configurações"
          onPress={() => void Linking.openSettings().catch(() => undefined)}
        />
      ) : (
        <Button
          label={refused ? 'Pedir permissão de novo' : 'Permitir câmera'}
          onPress={onRequest}
        />
      )}
    </Card>
  );
}

function ManualCodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const valid = normalizeEquipmentCode(code) !== null;

  return (
    <Card title="Identificação manual">
      <Input
        label="Código do QR ou patrimônio"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={EQUIPMENT_CODE_MAX}
        returnKeyType="search"
        onSubmitEditing={() => onSubmit(code)}
      />
      <Button label="Buscar equipamento" disabled={!valid} onPress={() => onSubmit(code)} />
    </Card>
  );
}
