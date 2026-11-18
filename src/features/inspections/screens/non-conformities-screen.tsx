import { useRouter } from 'expo-router';

import { EmptyState } from '@/design-system/components/empty-state';
import { BELOW_HEADER_EDGES, Screen } from '@/design-system/components/screen';

export function NonConformitiesScreen() {
  const router = useRouter();

  return (
    <Screen edges={BELOW_HEADER_EDGES}>
      <EmptyState
        icon="construct-outline"
        title="Registro de não conformidades em breve"
        description="Por enquanto, marque o item como não conforme e registre a observação e a evidência no próprio checklist."
        actionLabel="Voltar"
        onAction={() => router.back()}
      />
    </Screen>
  );
}
