import { View } from 'react-native';

import { useInspectionsDownload } from '@/application/sync/use-synchronization';
import { Button } from '@/design-system/components/button';
import { OfflineNotice } from '@/design-system/components/offline-notice';
import { Text } from '@/design-system/components/text';
import { describeApiFailure, isNetworkFailure } from '@/infrastructure/api';

/**
 * State of the latest download, shown above a screen that lists inspections.
 *
 * It only ever adds a notice: the list below keeps showing what the device
 * has, so a failed update never hides the work the technician has to do
 * (AC-MOBILE-LIST). Without signal it reads as offline mode, not as an error.
 */
export function DownloadStatus() {
  const download = useInspectionsDownload();

  if (download.isFetching) {
    return (
      <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
        Atualizando inspeções...
      </Text>
    );
  }

  if (download.error === null) {
    return null;
  }

  if (isNetworkFailure(download.error)) {
    return <OfflineNotice message="Sem conexão. Mostrando as inspeções salvas neste aparelho." />;
  }

  return (
    <View
      accessibilityRole="alert"
      className="gap-2 rounded-field bg-warning-soft px-3 py-2 dark:bg-neutral-800"
    >
      <Text variant="caption" tone="warning" className="font-semibold">
        Não foi possível atualizar. Mostrando as inspeções salvas neste aparelho.
      </Text>
      <Text variant="caption" tone="muted">
        {describeApiFailure(download.error)}
      </Text>
      <Button label="Tentar de novo" variant="secondary" onPress={() => void download.refetch()} />
    </View>
  );
}
