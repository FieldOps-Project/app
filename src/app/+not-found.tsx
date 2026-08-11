import { Link } from 'expo-router';

import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';

/** Fallback route rendered when no other route matches the address. */
export default function NotFoundScreen() {
  return (
    <Screen edges={['bottom', 'left', 'right']} className="items-center justify-center">
      <Text variant="subtitle">Esta tela não existe.</Text>
      <Text variant="body" tone="muted" className="text-center">
        O endereço acessado não corresponde a nenhuma rota do aplicativo.
      </Text>
      <Link href="/" className="text-brand-700 dark:text-brand-300">
        Voltar para o início
      </Link>
    </Screen>
  );
}
