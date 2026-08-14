import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { InspectionStatusBadge } from '@/components/inspection-status-badge';
import { SyncStateBadge } from '@/components/sync-state-badge';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { Input } from '@/design-system/components/input';
import { List } from '@/design-system/components/list';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { InspectionSummary } from '@/domain/inspection';
import { sampleInspections } from '@/features/inspections/data/sample-inspections';

export function InspectionsListScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const results = useMemo(() => filterInspections(sampleInspections, query), [query]);

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Inspeções</Text>
        <Text variant="body" tone="muted">
          Toque em uma inspeção para ver os detalhes.
        </Text>
      </View>

      <Input
        label="Buscar"
        placeholder="Cliente ou endereço"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />

      <List
        data={results}
        keyExtractor={(inspection) => inspection.id}
        empty={
          <EmptyState
            icon="search-outline"
            title="Nenhuma inspeção encontrada"
            description="Ajuste a busca ou limpe o filtro para ver todas as inspeções."
            actionLabel="Limpar busca"
            onAction={() => setQuery('')}
          />
        }
        renderItem={(inspection) => (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/inspections/[inspectionId]',
                params: { inspectionId: inspection.id },
              })
            }
          >
            <InspectionCard inspection={inspection} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

function filterInspections(
  inspections: readonly InspectionSummary[],
  query: string
): readonly InspectionSummary[] {
  const term = query.trim().toLowerCase();
  if (term === '') {
    return inspections;
  }
  return inspections.filter(
    (inspection) =>
      inspection.client.toLowerCase().includes(term) ||
      inspection.address.toLowerCase().includes(term)
  );
}

/** Delivery and sync state as badges: colour, icon and text, per document 13.9. */
function InspectionCard({ inspection }: { inspection: InspectionSummary }) {
  return (
    <Card>
      <Text variant="subtitle">{inspection.client}</Text>
      <Text variant="body" tone="muted">
        {inspection.address}
      </Text>
      <Text variant="caption" tone="muted">
        {inspection.scheduledFor}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <InspectionStatusBadge status={inspection.status} />
        <SyncStateBadge state={inspection.syncState} />
      </View>
      <Text variant="code" tone="muted">
        {inspection.id}
      </Text>
    </Card>
  );
}
