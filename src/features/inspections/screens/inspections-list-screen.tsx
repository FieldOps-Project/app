import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import {
  useInspectionList,
  type ListedInspection,
} from '@/application/inspections/use-inspection-list';
import { useInspectionsDownload } from '@/application/sync/use-synchronization';
import { Button } from '@/design-system/components/button';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { Input } from '@/design-system/components/input';
import { Loading } from '@/design-system/components/loading';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import {
  countActiveFilters,
  filtersForView,
  hasActiveFilters,
  NO_FILTERS,
  type InspectionFilters,
} from '@/domain/inspection-filters';
import { isInspectionView } from '@/domain/inspection-schedule';
import { InspectionCard } from '@/features/inspections/components/inspection-card';
import { InspectionFiltersPanel } from '@/features/inspections/components/inspection-filters-panel';
import { DownloadStatus } from '@/features/synchronization/components/download-status';
import { plural } from '@/utils/plural';

/**
 * The most used screen of the app (card #10).
 *
 * Reads what is stored on the device, so it opens and searches offline; the
 * download only adds to it, and its failure shows as a notice above a list
 * that stays in place. Virtualized with `FlatList` — never a mapped list in a
 * scroll view — so 200 inspections scroll smoothly (document 13.10).
 */
export function InspectionsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const [filters, setFilters] = useState<InspectionFilters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const list = useInspectionList(filters);
  const download = useInspectionsDownload();

  /**
   * A home block opens the list with its filter. The parameter is applied
   * while rendering (React's "adjust state on prop change" pattern) and then
   * cleared, so tapping the same block again re-applies it.
   */
  const [appliedView, setAppliedView] = useState<string | undefined>(undefined);
  if (params.view !== appliedView) {
    setAppliedView(params.view);
    if (params.view !== undefined && isInspectionView(params.view)) {
      setFilters(filtersForView(params.view));
    }
  }
  useEffect(() => {
    if (params.view !== undefined) {
      router.setParams({ view: undefined });
    }
  }, [params.view, router]);

  if (list.isLoading) {
    return <Loading label="Carregando inspeções do aparelho..." />;
  }

  if (list.isError) {
    return (
      <Screen>
        <ErrorState
          title="Não foi possível ler as inspeções"
          description="Os dados continuam no aparelho. Tente abrir de novo."
          onRetry={list.reload}
        />
      </Screen>
    );
  }

  const filtering = hasActiveFilters(filters);
  const activeCount = countActiveFilters(filters);

  return (
    <Screen padded={false}>
      <FlatList<ListedInspection>
        data={list.visible}
        keyExtractor={(entry) => entry.inspection.id}
        contentContainerClassName="gap-3 px-screen py-4"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={download.isFetching}
            onRefresh={() => void download.refetch()}
          />
        }
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            <View className="gap-1">
              <Text variant="title">Inspeções</Text>
              <Text variant="body" tone="muted">
                Puxe para baixo para atualizar.
              </Text>
            </View>

            <DownloadStatus />

            <Input
              label="Buscar"
              placeholder="Cliente, local ou equipamento"
              value={filters.query}
              onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />

            <View className="flex-row gap-2">
              <Button
                label={activeCount > 0 ? `Filtros (${activeCount})` : 'Filtros'}
                variant="secondary"
                className="flex-1"
                accessibilityState={{ expanded: showFilters }}
                onPress={() => setShowFilters((shown) => !shown)}
              />
              {filtering ? (
                <Button
                  label="Limpar"
                  variant="secondary"
                  className="flex-1"
                  onPress={() => setFilters(NO_FILTERS)}
                />
              ) : null}
            </View>

            {showFilters ? (
              <InspectionFiltersPanel filters={filters} onChange={setFilters} />
            ) : null}

            <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
              {filtering
                ? `${list.visible.length} de ${list.total} inspeções`
                : plural(list.total, 'inspeção', 'inspeções')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          filtering ? (
            <EmptyState
              icon="search-outline"
              title="Nenhuma inspeção com esses filtros"
              description="As outras inspeções continuam salvas no aparelho."
              actionLabel="Limpar filtros"
              onAction={() => setFilters(NO_FILTERS)}
            />
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title="Nenhuma inspeção atribuída a você"
              description="Quando o supervisor agendar uma inspeção, ela aparece aqui depois da atualização."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Abre o detalhe da inspeção"
            className="active:opacity-70"
            onPress={() =>
              router.push({
                pathname: '/inspections/[inspectionId]',
                params: { inspectionId: item.inspection.id },
              })
            }
          >
            <InspectionCard inspection={item.inspection} overdue={item.overdue} />
          </Pressable>
        )}
      />
    </Screen>
  );
}
