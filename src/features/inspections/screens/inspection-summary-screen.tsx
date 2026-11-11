import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';

import { describeLocalFailure } from '@/application/inspections/describe-local-failure';
import { useCompleteInspection } from '@/application/inspections/use-execution-actions';
import {
  useInspectionDetail,
  type InspectionWork,
} from '@/application/inspections/use-inspection-detail';
import { InspectionStatusBadge } from '@/components/inspection-status-badge';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import { countRequiredPending } from '@/domain/checklist-progress';
import { canEditAnswers, isAwaitingSend } from '@/domain/inspection-actions';
import {
  PendingList,
  ProgressSummary,
} from '@/features/checklist/components/checklist-progress-panel';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import {
  useReturnToChecklist,
  useReturnToChecklistItem,
} from '@/features/checklist/hooks/use-return-to-checklist';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { LocatingNotice, LocationConsent } from '@/features/location/components/location-consent';
import { describeRecordedLocation } from '@/features/location/describe-location';
import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import { formatDateTime } from '@/utils/format-date';

/**
 * Last step of the field work (UC-13, card #16): the totals, what still
 * blocks, and an explicit completion. The screen says plainly that
 * completing is not sending — the technician completes without signal and
 * the supervisor only receives it after a synchronization.
 */
export function InspectionSummaryScreen() {
  const inspectionId = useInspectionId();
  const inspection = useInspectionDetail(inspectionId);
  const router = useRouter();

  switch (inspection.state) {
    case 'loading':
      return <Loading label="Calculando o resumo..." />;
    case 'error':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <ErrorState
            title="Não foi possível montar o resumo"
            description="Os dados continuam no aparelho. Tente abrir de novo."
            onRetry={inspection.retry}
          />
        </Screen>
      );
    case 'not-found':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <EmptyState
            icon="alert-circle-outline"
            title="Inspeção não encontrada"
            description="Ela não está salva neste aparelho."
            actionLabel="Voltar"
            onAction={() => router.back()}
          />
        </Screen>
      );
    case 'ready':
      return <Summary work={inspection} />;
  }
}

function Summary({ work }: { work: InspectionWork }) {
  const { detail, progress, evidenceCounts } = work;
  const router = useRouter();
  const returnToChecklist = useReturnToChecklist(detail.id);
  const openItem = useReturnToChecklistItem(detail.id);
  const complete = useCompleteInspection(detail.id);
  const [confirming, setConfirming] = useState(false);

  const editable = canEditAnswers(detail.status);
  const requiredPending = countRequiredPending(progress);
  const evidences = [...evidenceCounts.values()].reduce((total, count) => total + count, 0);
  const completedHere = isAwaitingSend(detail.status, detail.syncState);

  function askConfirmation() {
    complete.reset();
    setConfirming(true);
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-2">
        <Text variant="title">Resumo</Text>
        <Text variant="body" tone="muted">
          {detail.title} · {detail.clientName}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <InspectionStatusBadge status={detail.status} />
          <SyncStateBadge state={detail.syncState} />
        </View>
      </View>

      <Card title="Totais">
        <ProgressSummary progress={progress} />
        <Total icon="list-outline" label="Itens no checklist" value={progress.total} />
        <Total
          icon="checkmark-circle-outline"
          label={`Respondidos de ${progress.applicable} aplicáveis`}
          value={progress.answered}
        />
        <Total
          icon="alert-circle-outline"
          label="Obrigatórios pendentes"
          value={requiredPending}
          tone={requiredPending > 0 ? 'danger' : 'default'}
        />
        <Total
          icon="warning-outline"
          label="Não conformidades"
          value={progress.nonConformities}
          tone={progress.nonConformities > 0 ? 'warning' : 'default'}
        />
        <Total icon="images-outline" label="Evidências" value={evidences} />
        {detail.startedAtDevice === null ? null : (
          <LocationLine text={describeRecordedLocation('start', detail.startLocation)} />
        )}
        {detail.completedAtDevice === null ? null : (
          <LocationLine text={describeRecordedLocation('completion', detail.completionLocation)} />
        )}
        {detail.completedAtDevice === null ? null : (
          <Text variant="caption" tone="muted">
            Concluída neste aparelho em {formatDateTime(detail.completedAtDevice)}.
          </Text>
        )}
      </Card>

      {editable ? (
        <>
          <PendingList pending={progress.pending} onSelect={openItem} />

          {progress.pending.length > 0 ? (
            <Card title="Conclusão bloqueada">
              <Text variant="body">
                Resolva as pendências acima para concluir. Toque em uma delas para ir ao item.
              </Text>
              <Button label="Voltar ao checklist" variant="secondary" onPress={returnToChecklist} />
            </Card>
          ) : confirming ? (
            <Card title="Concluir a inspeção?" className="border-2 border-brand-600">
              <Text variant="body">
                Depois de concluir, as respostas ficam bloqueadas para edição. O horário deste
                aparelho fica registrado como o momento da conclusão.
              </Text>
              <LocationConsent moment="completion" />
              <SendingNotice />
              <FieldError
                message={
                  complete.error === null
                    ? undefined
                    : `A inspeção não foi concluída: ${describeLocalFailure(complete.error)}`
                }
              />
              {complete.locating ? <LocatingNotice /> : null}
              <Button
                label="Confirmar conclusão"
                loading={complete.isPending}
                onPress={() =>
                  complete.mutate(undefined, { onSuccess: () => setConfirming(false) })
                }
              />
              <Button
                label="Revisar antes"
                variant="secondary"
                onPress={() => setConfirming(false)}
              />
            </Card>
          ) : (
            <Card title="Tudo pronto">
              <SendingNotice />
              <Button label="Concluir inspeção" onPress={askConfirmation} />
            </Card>
          )}
        </>
      ) : completedHere ? (
        <Card title="Concluída neste aparelho" className="border-2 border-warning">
          <View className="flex-row items-start gap-2">
            <Ionicons name="cloud-upload-outline" size={22} color={colors.warning.DEFAULT} />
            <Text variant="body" className="flex-1">
              A inspeção está concluída, mas{' '}
              <Text variant="body" className="font-semibold">
                ainda não foi enviada
              </Text>
              . O supervisor só recebe depois da sincronização.
            </Text>
          </View>
          <SyncNowButton />
          <Button
            label="Voltar ao início"
            variant="secondary"
            onPress={() => router.navigate('/')}
          />
        </Card>
      ) : (
        <Card title="Modo consulta">
          <Text variant="body">
            Esta inspeção não está em andamento: o resumo é apenas para consulta.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

/** "Concluir" is not "enviar" — said every time completion is on screen. */
function SendingNotice() {
  return (
    <View className="flex-row items-start gap-2 rounded-field bg-info-soft p-3 dark:bg-neutral-800">
      <Ionicons name="information-circle-outline" size={20} color={colors.info.DEFAULT} />
      <Text variant="body" tone="info" className="flex-1">
        Concluir não é enviar. Sem internet, a inspeção fica salva no aparelho como aguardando
        sincronização e é enviada ao supervisor quando houver conexão.
      </Text>
    </View>
  );
}

function LocationLine({ text }: { text: string }) {
  return (
    <View className="flex-row items-start gap-2">
      <Ionicons name="navigate-outline" size={18} color={colors.neutral[500]} />
      <Text variant="body" tone="muted" className="flex-1">
        {text}
      </Text>
    </View>
  );
}

interface TotalProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'warning';
}

const TONE_COLORS = {
  default: colors.neutral[500],
  danger: colors.danger.DEFAULT,
  warning: colors.warning.DEFAULT,
} as const;

function Total({ icon, label, value, tone = 'default' }: TotalProps) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={18} color={TONE_COLORS[tone]} />
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      <Text variant="subtitle" tone={tone}>
        {value}
      </Text>
    </View>
  );
}
