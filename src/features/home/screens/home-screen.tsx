import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { useHomeOverview } from '@/application/inspections/use-home-overview';
import { useSession } from '@/application/session/session-context';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { ErrorState } from '@/design-system/components/error-state';
import { Loading } from '@/design-system/components/loading';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { colors } from '@/design-system/tokens/design-tokens';
import type { InspectionView } from '@/domain/inspection-schedule';
import { DownloadStatus } from '@/features/synchronization/components/download-status';
import { SyncNowButton } from '@/features/synchronization/components/sync-now-button';
import { plural } from '@/utils/plural';

/**
 * First screen after sign-in (document 13.4): what is due today, what is late,
 * what is under way and what has not been sent. The pending count lives here,
 * not only on the sync tab, so unsent work is noticed without looking for it
 * (document 13.8).
 */
export function HomeScreen() {
  const { session } = useSession();
  const overview = useHomeOverview();
  const router = useRouter();

  function openList(view: InspectionView) {
    router.push({ pathname: '/inspections', params: { view } });
  }

  const firstName = session?.name.split(' ')[0] ?? 'técnico';

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Olá, {firstName}</Text>
        <Text variant="body" tone="muted">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </Text>
      </View>

      <DownloadStatus />

      {overview.state === 'loading' ? (
        <Loading label="Carregando inspeções do aparelho..." />
      ) : overview.state === 'error' ? (
        <ErrorState
          title="Não foi possível ler as inspeções"
          description="Os dados continuam no aparelho. Tente abrir de novo."
          onRetry={overview.retry}
        />
      ) : (
        <>
          <PendingSyncCard
            pendingOperations={overview.pendingOperations}
            inspectionsWithUnsentWork={overview.day.withUnsentWork}
            onOpen={() => openList('pending-sync')}
          />

          <View className="gap-3">
            <DayBlock
              icon="today-outline"
              title="Hoje"
              count={overview.day.today}
              emptyText="Nenhuma inspeção marcada para hoje."
              onPress={() => openList('today')}
            />
            <DayBlock
              icon="alarm-outline"
              title="Atrasadas"
              count={overview.day.overdue}
              tone="danger"
              emptyText="Nada atrasado. Tudo em dia."
              onPress={() => openList('overdue')}
            />
            <DayBlock
              icon="construct-outline"
              title="Em andamento"
              count={overview.day.inProgress}
              emptyText="Nenhuma inspeção em andamento."
              onPress={() => openList('in-progress')}
            />
          </View>
        </>
      )}

      <Card title="Ações rápidas">
        <Button
          label="Ler QR Code do equipamento"
          variant="secondary"
          onPress={() => router.push('/scanner')}
        />
      </Card>
    </Screen>
  );
}

interface PendingSyncCardProps {
  pendingOperations: number;
  inspectionsWithUnsentWork: number;
  onOpen: () => void;
}

/** RN-071: the pending count, with the action that clears it right next to it. */
function PendingSyncCard({
  pendingOperations,
  inspectionsWithUnsentWork,
  onOpen,
}: PendingSyncCardProps) {
  const hasPending = pendingOperations > 0;

  return (
    <Card title="Sincronização">
      <View className="flex-row items-center gap-3">
        <Ionicons
          name={hasPending ? 'cloud-upload-outline' : 'cloud-done-outline'}
          size={28}
          color={hasPending ? colors.warning.DEFAULT : colors.success.DEFAULT}
        />
        <View className="flex-1 gap-0.5">
          <Text variant="subtitle" tone={hasPending ? 'warning' : 'success'}>
            {hasPending
              ? plural(pendingOperations, 'registro aguardando envio', 'registros aguardando envio')
              : 'Tudo enviado'}
          </Text>
          <Text variant="caption" tone="muted">
            {hasPending
              ? 'Salvos no aparelho. Sincronize quando tiver internet.'
              : 'Nenhum registro pendente neste aparelho.'}
          </Text>
        </View>
      </View>
      <SyncNowButton variant={hasPending ? 'primary' : 'secondary'} />
      {hasPending || inspectionsWithUnsentWork > 0 ? (
        <Button label="Ver inspeções não enviadas" variant="secondary" onPress={onOpen} />
      ) : null}
    </Card>
  );
}

interface DayBlockProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  count: number;
  emptyText: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}

/**
 * One block of the day. Zero is a good result and reads as one, in a neutral
 * tone with a positive message — never as an error.
 */
function DayBlock({ icon, title, count, emptyText, tone = 'default', onPress }: DayBlockProps) {
  const isEmpty = count === 0;
  const isAlert = tone === 'danger' && !isEmpty;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${plural(count, 'inspeção', 'inspeções')}`}
      accessibilityHint="Abre a lista com este filtro"
      onPress={onPress}
      className="active:opacity-70"
    >
      <Card>
        <View className="flex-row items-center gap-3">
          <Ionicons
            name={isEmpty ? 'checkmark-circle-outline' : icon}
            size={28}
            color={
              isAlert
                ? colors.danger.DEFAULT
                : isEmpty
                  ? colors.success.DEFAULT
                  : colors.brand.DEFAULT
            }
          />
          <View className="flex-1 gap-0.5">
            <Text variant="label" tone="muted">
              {title}
            </Text>
            {isEmpty ? (
              <Text variant="body" tone="success">
                {emptyText}
              </Text>
            ) : (
              <Text variant="subtitle" tone={isAlert ? 'danger' : 'default'}>
                {plural(count, 'inspeção', 'inspeções')}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
        </View>
      </Card>
    </Pressable>
  );
}
