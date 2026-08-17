import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/application/session/session-context';
import { env } from '@/config/env';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { ErrorState } from '@/design-system/components/error-state';
import { OfflineNotice } from '@/design-system/components/offline-notice';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import { useApiHealth } from '@/features/home/hooks/use-api-health';
import { describeApiFailure, isNetworkFailure, type ApiFailure } from '@/infrastructure/api';

export function HomeScreen() {
  const { session } = useSession();
  const health = useApiHealth();
  const router = useRouter();

  return (
    <Screen scrollable>
      <View className="gap-1">
        <Text variant="title">Olá, {session?.name.split(' ')[0] ?? 'técnico'}</Text>
        <Text variant="body" tone="muted">
          Acompanhe suas inspeções do dia.
        </Text>
      </View>

      <Card title="Ações rápidas">
        <Button label="Ver inspeções" onPress={() => router.push('/inspections')} />
        <Button label="Ler código" variant="secondary" onPress={() => router.push('/scanner')} />
      </Card>

      <Card title="Ambiente">
        <Row label="Perfil" value={env.appEnv} />
        <Row label="API" value={env.apiUrl} />
      </Card>

      <Card title="Conexão com a API">
        <ApiHealthStatus
          isPending={health.isPending}
          isFetching={health.isFetching}
          error={health.error}
          status={health.data?.status}
          onRetry={() => void health.refetch()}
        />
      </Card>
    </Screen>
  );
}

interface ApiHealthStatusProps {
  isPending: boolean;
  isFetching: boolean;
  error: ApiFailure | null;
  status: string | undefined;
  onRetry: () => void;
}

function ApiHealthStatus({ isPending, isFetching, error, status, onRetry }: ApiHealthStatusProps) {
  if (isPending || isFetching) {
    return (
      <Text variant="body" tone="muted">
        Consultando a API...
      </Text>
    );
  }

  if (error) {
    // Losing the network is normal offline operation, never an error banner.
    if (isNetworkFailure(error)) {
      return (
        <View className="gap-3">
          <OfflineNotice message="Sem conexão com a API. O aplicativo continua utilizável offline." />
          <Button label="Testar novamente" variant="secondary" onPress={onRetry} />
        </View>
      );
    }

    return (
      <ErrorState
        title="Sem resposta da API"
        description={describeApiFailure(error)}
        retryLabel="Testar novamente"
        onRetry={onRetry}
      />
    );
  }

  return (
    <View className="gap-3">
      <Text variant="body" tone="success">
        API respondeu{status ? `: ${status}` : ' com sucesso'}.
      </Text>
      <Button label="Testar novamente" variant="secondary" onPress={onRetry} />
    </View>
  );
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <View className="flex-row items-baseline justify-between gap-4">
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="code" className="flex-1 text-right">
        {value}
      </Text>
    </View>
  );
}
