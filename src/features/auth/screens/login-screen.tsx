import { useState } from 'react';
import { View } from 'react-native';

import { useSession } from '@/application/session/session-context';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Input } from '@/design-system/components/input';
import { OfflineNotice } from '@/design-system/components/offline-notice';
import { Screen } from '@/design-system/components/screen';
import { Text } from '@/design-system/components/text';
import {
  describeApiFailure,
  isNetworkFailure,
  type ApiFailure,
  type PresentableApiFailure,
} from '@/infrastructure/api';

/**
 * Login copy never reveals whether the e-mail exists (document 17.2, AC-AUTH):
 * a bad password and an unknown e-mail both surface this same generic message,
 * overriding `describeApiFailure`'s session-expiry wording for `unauthorized`,
 * which belongs to an already-signed-in context, not this one.
 */
function describeLoginFailure(failure: PresentableApiFailure): string {
  if (failure.kind === 'unauthorized') {
    return 'E-mail ou senha inválidos.';
  }
  return describeApiFailure(failure);
}

export function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isPending;

  async function submit() {
    setIsPending(true);
    setFailure(null);
    try {
      const result = await signIn({ email: email.trim(), password });
      if (!result.ok) {
        setFailure(result.error);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Screen scrollable className="justify-center">
      <View className="gap-1">
        <Text variant="title">FieldOps</Text>
        <Text variant="body" tone="muted">
          Entre para acessar suas inspeções.
        </Text>
      </View>

      <Card title="Acesso">
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          editable={!isPending}
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          editable={!isPending}
          onSubmitEditing={() => void submit()}
        />

        {failure === null ? null : isNetworkFailure(failure) ? (
          <OfflineNotice message="Sem conexão com a API. Verifique a internet e tente novamente." />
        ) : (
          <Text variant="body" tone="danger">
            {describeLoginFailure(failure)}
          </Text>
        )}

        <Button
          label="Entrar"
          loading={isPending}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
      </Card>
    </Screen>
  );
}
