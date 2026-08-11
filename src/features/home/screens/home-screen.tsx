import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/application/session/session-context';
import { env } from '@/config/env';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import type { DomainError } from '@/domain/result';
import { useApiHealth } from '@/features/home/hooks/use-api-health';

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
        />
        <Button
          label="Testar novamente"
          variant="secondary"
          loading={health.isFetching}
          onPress={() => void health.refetch()}
        />
      </Card>
    </Screen>
  );
}

interface ApiHealthStatusProps {
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  status: string | undefined;
}

function ApiHealthStatus({ isPending, isFetching, error, status }: ApiHealthStatusProps) {
  if (isPending || isFetching) {
    return (
      <Text variant="body" tone="muted">
        Consultando a API...
      </Text>
    );
  }

  if (error) {
    return (
      <View className="gap-1">
        <Text variant="body" tone="danger">
          {messageFor(error)}
        </Text>
        <Text variant="caption" tone="muted">
          Confirme se a API está no ar e se EXPO_PUBLIC_API_URL usa um endereço alcançável pelo
          aparelho. O aplicativo continua utilizável sem a API.
        </Text>
      </View>
    );
  }

  return (
    <Text variant="body" tone="success">
      API respondeu{status ? `: ${status}` : ' com sucesso'}.
    </Text>
  );
}

function messageFor(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as DomainError).message);
  }
  return 'Falha inesperada ao consultar a API.';
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
