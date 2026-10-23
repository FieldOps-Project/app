import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';

import { useInspectionDraft } from '@/application/inspection-draft/inspection-draft-context';
import { useSaveAnswer } from '@/application/inspections/use-checklist-actions';
import {
  useInspectionDetail,
  type InspectionWork,
} from '@/application/inspections/use-inspection-detail';
import { NavigationDepthBadge } from '@/components/navigation-depth-badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { toSections, type ChecklistItem, type ChecklistSection } from '@/domain/checklist';
import { nextPending } from '@/domain/checklist-progress';
import type { InspectionStatus } from '@/domain/inspection';
import { canEditAnswers } from '@/domain/inspection-actions';
import { ChecklistItemRow } from '@/features/checklist/components/checklist-item-row';
import {
  PendingList,
  ProgressSummary,
  SectionTabs,
} from '@/features/checklist/components/checklist-progress-panel';
import { FieldError } from '@/features/checklist/components/response-fields/field-error';
import type { ResponseFormOutput } from '@/schemas/checklist-response';
import { useInspectionId } from '@/features/inspections/hooks/use-inspection-id';
import { plural } from '@/utils/plural';

type Row =
  | { readonly kind: 'section'; readonly key: string; readonly section: ChecklistSection }
  | { readonly kind: 'item'; readonly key: string; readonly item: ChecklistItem };

/** Sections and items as one flat, virtualized list, in the snapshot's order. */
function toRows(items: readonly ChecklistItem[]): Row[] {
  return toSections(items).flatMap((section): Row[] => [
    { kind: 'section', key: `section-${section.order}`, section },
    ...section.items.map((item): Row => ({ kind: 'item', key: item.id, item })),
  ]);
}

/**
 * The checklist, built at run time from the inspection's snapshot (card #12):
 * the app does not know how many sections or items exist, nor their types,
 * until it reads them.
 */
export function ChecklistScreen() {
  const inspectionId = useInspectionId();
  const inspection = useInspectionDetail(inspectionId);
  const router = useRouter();

  switch (inspection.state) {
    case 'loading':
      return <Loading label="Montando o checklist..." />;
    case 'error':
      return (
        <Screen edges={BELOW_HEADER_EDGES}>
          <ErrorState
            title="Não foi possível abrir o checklist"
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
      return <Checklist work={inspection} />;
  }
}

function Checklist({ work }: { work: InspectionWork }) {
  const { detail, items, responses, evidenceCounts, progress } = work;
  const router = useRouter();
  const listRef = useRef<FlatList<Row>>(null);
  const { focusedItemFor, focusItem } = useInspectionDraft();
  const saveAnswer = useSaveAnswer(detail.id);
  const [showPending, setShowPending] = useState(false);
  const headerHeight = useHeaderHeight();

  const editable = canEditAnswers(detail.status);
  const focusedItemId = focusedItemFor(detail.id);
  const rows = useMemo(() => toRows(items), [items]);
  const toCorrect = useMemo(
    () => new Set(detail.status === 'REJECTED' ? (detail.review?.itemsToCorrect ?? []) : []),
    [detail.status, detail.review]
  );
  const blocking = useMemo(() => {
    const reasons = new Map<string, Set<string>>();
    for (const entry of progress.pending) {
      reasons.set(entry.itemId, (reasons.get(entry.itemId) ?? new Set()).add(entry.reason));
    }
    return reasons;
  }, [progress.pending]);

  function scrollToRow(index: number) {
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
    }
  }

  /**
   * The pending panel stays open: collapsing it in the same tick would shift
   * the content by its height after the scroll was measured.
   */
  function goToItem(itemId: string) {
    focusItem(detail.id, itemId);
    scrollToRow(rows.findIndex((row) => row.key === itemId));
  }

  /**
   * Text answers save when editing ends. Dismissing the keyboard before
   * leaving the screen ends the edit, so nothing typed is left unsaved behind
   * the next screen.
   */
  function leaveTo(navigate: () => void) {
    Keyboard.dismiss();
    navigate();
  }

  function goToSection(sectionOrder: number) {
    scrollToRow(rows.findIndex((row) => row.key === `section-${sectionOrder}`));
  }

  function captureEvidence(itemId: string) {
    focusItem(detail.id, itemId);
    leaveTo(() =>
      router.push({ pathname: '/evidence/capture', params: { inspectionId: detail.id, itemId } })
    );
  }

  function save(itemId: string, answer: ResponseFormOutput) {
    focusItem(detail.id, itemId);
    saveAnswer.save(itemId, answer);
  }

  /**
   * Coming back to the checklist lands on the item the technician was on
   * (document 13.9). Done once per mount, and only marked done when the
   * scroll actually ran — a re-render that cancels the timer retries it.
   * While the screen stays mounted under the camera, the list keeps its own
   * position.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || focusedItemId === null) {
      return;
    }
    const index = rows.findIndex((row) => row.key === focusedItemId);
    const timer = setTimeout(() => {
      restored.current = true;
      scrollToRow(index);
    }, 0);
    return () => clearTimeout(timer);
  });

  /**
   * Another screen — the summary's pending list — can send the technician to
   * an item of this already mounted checklist through the `itemId` parameter.
   */
  const { itemId: requestedItemId } = useLocalSearchParams<{ itemId?: string }>();
  useEffect(() => {
    if (requestedItemId === undefined || requestedItemId === '') {
      return;
    }
    goToItem(requestedItemId);
    router.setParams({ itemId: undefined });
  });

  const scrollRetried = useRef(false);

  const next = nextPending(progress, items, focusedItemId);

  return (
    <Screen edges={BELOW_HEADER_EDGES} padded={false}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
      >
        <View className="gap-3 border-b border-neutral-200 bg-neutral-50 px-screen py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <ProgressSummary progress={progress} />
          {editable ? (
            <View className="flex-row gap-2">
              <Button
                label={`Pendências (${progress.pending.length})`}
                variant="secondary"
                className="flex-1"
                accessibilityState={{ expanded: showPending }}
                onPress={() => {
                  setShowPending((shown) => !shown);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
              />
              <Button
                label="Próxima pendência"
                variant="secondary"
                className="flex-1"
                disabled={next === null}
                onPress={() => next !== null && goToItem(next.itemId)}
              />
            </View>
          ) : null}
        </View>

        <FlatList<Row>
          ref={listRef}
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerClassName="gap-3 px-screen py-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            if (!scrollRetried.current) {
              scrollRetried.current = true;
              setTimeout(() => {
                scrollRetried.current = false;
                scrollToRow(index);
              }, 100);
            }
          }}
          ListHeaderComponent={
            <View className="gap-3">
              <NavigationDepthBadge />
              <StatusNotice status={detail.status} inspectionId={detail.id} />
              <FieldError
                message={
                  saveAnswer.error === null
                    ? undefined
                    : `A resposta não foi salva: ${saveAnswer.error.message}`
                }
              />
              {showPending ? <PendingList pending={progress.pending} onSelect={goToItem} /> : null}
              <SectionTabs progress={progress} onSelect={goToSection} />
            </View>
          }
          ListFooterComponent={
            <Button
              label="Ver resumo"
              variant={editable && progress.pending.length === 0 ? 'primary' : 'secondary'}
              onPress={() =>
                leaveTo(() =>
                  router.push({
                    pathname: '/inspections/[inspectionId]/summary',
                    params: { inspectionId: detail.id },
                  })
                )
              }
            />
          }
          renderItem={({ item: row }) =>
            row.kind === 'section' ? (
              <SectionHeader section={row.section} progress={progress} />
            ) : (
              <ChecklistItemRow
                item={row.item}
                response={responses.get(row.item.id)}
                evidenceCount={evidenceCounts.get(row.item.id) ?? 0}
                needsObservation={blocking.get(row.item.id)?.has('OBSERVATION_REQUIRED') ?? false}
                needsEvidence={blocking.get(row.item.id)?.has('EVIDENCE_REQUIRED') ?? false}
                toCorrect={toCorrect.has(row.item.id)}
                editable={editable}
                focused={row.item.id === focusedItemId}
                onSave={save}
                onCaptureEvidence={captureEvidence}
              />
            )
          }
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SectionHeader({
  section,
  progress,
}: {
  section: ChecklistSection;
  progress: InspectionWork['progress'];
}) {
  const counts = progress.sections.find((entry) => entry.order === section.order);
  return (
    <View accessibilityRole="header" className="gap-0.5 pt-2">
      <Text variant="label" tone="muted">
        {section.title}
      </Text>
      {section.description === null ? null : (
        <Text variant="caption" tone="muted">
          {section.description}
        </Text>
      )}
      {counts === undefined ? null : (
        <Text variant="caption" tone={counts.complete ? 'success' : 'muted'}>
          {counts.complete
            ? 'Seção completa'
            : `${counts.answered} de ${plural(counts.applicable, 'item', 'itens')}`}
        </Text>
      )}
    </View>
  );
}

/** Why the answers are locked, when they are, and the way forward. */
function StatusNotice({
  status,
  inspectionId,
}: {
  status: InspectionStatus;
  inspectionId: string;
}) {
  const router = useRouter();

  switch (status) {
    case 'IN_PROGRESS':
      return null;
    case 'ASSIGNED':
      return (
        <Card title="Inspeção não iniciada">
          <Text variant="body">Inicie a inspeção para responder o checklist.</Text>
          <Button
            label="Iniciar inspeção"
            onPress={() =>
              router.replace({
                pathname: '/inspections/[inspectionId]/start',
                params: { inspectionId },
              })
            }
          />
        </Card>
      );
    case 'REJECTED':
      return (
        <Card title="Modo consulta">
          <Text variant="body">
            Inspeção reprovada. Os itens a corrigir estão marcados; a reabertura para correção ainda
            não está disponível neste aparelho.
          </Text>
        </Card>
      );
    case 'CANCELED':
      return (
        <Card title="Modo consulta">
          <Text variant="body">Inspeção cancelada. As respostas ficam apenas para consulta.</Text>
        </Card>
      );
    default:
      return (
        <Card title="Modo consulta">
          <Text variant="body">Inspeção concluída: as respostas ficam bloqueadas para edição.</Text>
        </Card>
      );
  }
}
