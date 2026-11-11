import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { useIdentifyEquipment } from '@/application/equipment/identify-equipment';
import { useInspectionDetail } from '@/application/inspections/use-inspection-detail';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { ErrorState } from '@/design-system/components/error-state';
import { Input } from '@/design-system/components/input';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import {
  EQUIPMENT_CODE_MAX,
  normalizeEquipmentCode,
  type CodeSource,
} from '@/domain/equipment-identification';
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
  const cycleLocked = useRef(false);

  function lookUp(raw: string, source: CodeSource) {
    const code = normalizeEquipmentCode(raw);
    if (code === null || cycleLocked.current) {
      return;
    }
    cycleLocked.current = true;
    identify.mutate({ code, source });
  }

  function scanAgain() {
    cycleLocked.current = false;
    identify.reset();
  }

  function openInspection(id: string) {
    router.replace({ pathname: '/inspections/[inspectionId]', params: { inspectionId: id } });
  }

  const expectsEquipment = inspectionId !== undefined && inspectionId !== '';
  if (expectsEquipment && inspection.state === 'loading') {
    return <Loading label="Carregando a inspeção..." />;
  }
  if (expectsEquipment && inspection.state !== 'ready') {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <ErrorState
          title="Inspeção indisponível"
          description="Não foi possível abrir a inspeção para comparar o equipamento. Volte e tente de novo."
          retryLabel="Voltar"
          onRetry={() => router.back()}
        />
      </Screen>
    );
  }

  if (identify.isPending) {
    return <Loading label="Procurando o equipamento..." />;
  }

  if (identify.isError) {
    return (
      <Screen edges={BELOW_HEADER_EDGES}>
        <ErrorState
          title="Não foi possível procurar o equipamento"
          description="A busca falhou neste aparelho. Tente ler o código de novo."
          retryLabel="Tentar de novo"
          onRetry={scanAgain}
        />
      </Screen>
    );
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
              onBarcodeScanned={({ data }: BarcodeScanningResult) => lookUp(data, 'camera')}
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
        <ManualCodeForm onSubmit={(code) => lookUp(code, 'manual')} />
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
