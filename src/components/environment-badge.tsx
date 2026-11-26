import { ENVIRONMENT_LABELS, env, isProduction } from '@/config/env';
import { Badge } from '@/design-system/components/badge';

export function EnvironmentBadge() {
  if (isProduction || env.appEnv === 'local') {
    return null;
  }

  return (
    <Badge
      tone="warning"
      icon="flask-outline"
      label={`Ambiente: ${ENVIRONMENT_LABELS[env.appEnv]}`}
    />
  );
}
