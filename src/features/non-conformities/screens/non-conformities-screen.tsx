import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { describeLocalFailure } from '@/application/inspections/describe-local-failure';
import {
  useInspectionDetail,
  type InspectionWork,
} from '@/application/inspections/use-inspection-detail';
import {
  useCreateNonConformity,
  useDeleteNonConformity,
  useNonConformities,
} from '@/application/non-conformities/use-non-conformities';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { canEditAnswers } from '@/domain/inspection-actions';
import { useReturnToChecklist } from '@/features/checklist/hooks/use-return-to-checklist';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { NonConformityCard } from '@/features/non-conformities/components/non-conformity-card';
import { NonConformityForm } from '@/features/non-conformities/components/non-conformity-form';
import { plural } from '@/utils/plural';

export function NonConformitiesScreen() {
  const inspectionId = useInspectionId();
  const inspection = useInspectionDetail(inspectionId);
  const router = useRouter();

  switch (inspection.state) {
    case 'loading':
      return <Loading label="Abrindo as não conformidades..." />;
    case 'error':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <ErrorState
            title="Não foi possível abrir a inspeção"
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
      return <NonConformities work={inspection} />;
  }
}

function NonConformities({ work }: { work: InspectionWork }) {
  const { detail, items } = work;
  const router = useRouter();
  const returnToChecklist = useReturnToChecklist(detail.id);
  const { itemId = '' } = useLocalSearchParams<{ itemId?: string }>();
  const list = useNonConformities(detail.id);
  const create = useCreateNonConformity(detail.id);
  const remove = useDeleteNonConformity(detail.id);

  const editable = canEditAnswers(detail.status);
  const item = items.find((entry) => entry.id === itemId);
  const registering = editable && item !== undefined;

  function closeForm() {
    create.reset();
    router.setParams({ itemId: undefined });
  }

  function capture(nonConformityId: string) {
    const target = list.data?.find((entry) => entry.id === nonConformityId);
    if (target?.inspectionItemId == null) {
      return;
    }
    router.push({
      pathname: '/evidence/capture',
      params: { inspectionId: detail.id, itemId: target.inspectionItemId, nonConformityId },
    });
  }

  return (
    <Screen scrollable edges={BELOW_HEADER_EDGES}>
      <View className="gap-1">
        <Text variant="title">Não conformidades</Text>
        <Text variant="body" tone="muted">
          {detail.title}
        </Text>
      </View>

      {registering ? (
        <Card title="Nova não conformidade" className="border-2 border-brand-600">
          <Text variant="body" tone="muted">
            {`Item: ${item.itemTitle}`}
          </Text>
          <NonConformityForm
            pending={create.isPending}
            failure={
              create.error === null
                ? undefined
                : `A não conformidade não foi registrada: ${describeLocalFailure(create.error)}`
            }
            onSubmit={(form) =>
              create.mutate({ inspectionItemId: item.id, form }, { onSuccess: closeForm })
            }
            onCancel={closeForm}
          />
        </Card>
      ) : null}

      {list.isPending ? (
        <Text variant="body" tone="muted" accessibilityLiveRegion="polite">
          Carregando...
        </Text>
      ) : list.isError ? (
        <ErrorState
          title="Não foi possível ler as não conformidades"
          description="Os dados continuam no aparelho. Tente abrir de novo."
          onRetry={() => void list.refetch()}
        />
      ) : list.data.length === 0 ? (
        registering ? null : (
          <EmptyState
            icon="shield-checkmark-outline"
            title="Nenhuma não conformidade registrada"
            description="Para registrar uma, marque um item como não conforme no checklist e toque em Registrar não conformidade."
          />
        )
      ) : (
        <View className="gap-3">
          <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
            {plural(
              list.data.length,
              'não conformidade registrada',
              'não conformidades registradas'
            )}
          </Text>
          {remove.error === null ? null : (
            <Text variant="body" tone="danger" accessibilityRole="alert">
              Não foi possível excluir. Tente novamente.
            </Text>
          )}
          {remove.data?.outcome === 'already-sent' ? (
            <Text variant="body" tone="warning" accessibilityRole="alert">
              Esta não conformidade já foi enviada ao servidor e não pode ser excluída.
            </Text>
          ) : null}
          {list.data.map((nonConformity) => (
            <NonConformityCard
              key={nonConformity.id}
              nonConformity={nonConformity}
              editable={editable}
              deleting={remove.isPending && remove.variables === nonConformity.id}
              onCaptureEvidence={capture}
              onDelete={(id) => remove.mutate(id)}
            />
          ))}
        </View>
      )}

      <Button label="Voltar ao checklist" variant="secondary" onPress={returnToChecklist} />
    </Screen>
  );
}
