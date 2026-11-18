import { useConnectivity } from '@/application/connectivity/connectivity-context';
import {
  useOwnerUserId,
  usePendingOperationsCount,
} from '@/application/inspections/use-inspections';
import { OfflineNotice } from '@/design-system/components/offline-notice';
import { plural } from '@/utils/plural';

const REASON_TEXT = {
  'no-network': 'Sem conexão com a internet.',
  'server-unreachable': 'Sem acesso ao servidor.',
} as const;

export function OfflineBanner() {
  const { offline, reason } = useConnectivity();
  const ownerUserId = useOwnerUserId();
  const pending = usePendingOperationsCount();

  if (!offline || reason === null) {
    return null;
  }

  const waiting = ownerUserId !== '' ? (pending.data ?? 0) : 0;
  const pendingText =
    waiting > 0
      ? ` ${plural(waiting, 'registro aguardando envio', 'registros aguardando envio')}.`
      : '';

  return (
    <OfflineNotice
      className="mx-screen my-2"
      message={`${REASON_TEXT[reason]} Você pode continuar: tudo fica salvo neste aparelho e é enviado quando a conexão voltar.${pendingText}`}
    />
  );
}
