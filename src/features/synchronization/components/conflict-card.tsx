import { View } from 'react-native';

import { useInspectionConflicts } from '@/application/inspections/use-inspections';
import { Card } from '@/design-system/components/card';
import { Text } from '@/design-system/components/text';
import { sameAnswer, summarizeAnswer } from '@/domain/answer-summary';
import type { ConflictingRecord } from '@/infrastructure/repositories/conflict-repository';

function Side({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-0.5">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

function ConflictItem({ record }: { record: ConflictingRecord }) {
  const title = record.itemTitle ?? 'Registro da inspeção';

  return (
    <View className="gap-2 rounded-card border border-warning p-3">
      <Text variant="label">{title}</Text>
      {record.local === null ? (
        <Text variant="body">{record.message ?? 'Este registro divergiu do servidor.'}</Text>
      ) : (
        <>
          <Side label="Registrado neste aparelho" value={summarizeAnswer(record.local)} />
          {record.server === null ? (
            <Text variant="caption" tone="muted">
              O valor do servidor ainda não foi consultado. Sincronize com internet para ver.
            </Text>
          ) : (
            <Side
              label="Valor no servidor"
              value={
                sameAnswer(record.local, record.server)
                  ? `${summarizeAnswer(record.server)} (igual, mas em outra versão)`
                  : summarizeAnswer(record.server)
              }
            />
          )}
        </>
      )}
    </View>
  );
}

export function ConflictCard({ inspectionId }: { inspectionId: string }) {
  const conflicts = useInspectionConflicts(inspectionId);

  if (conflicts.data === undefined || conflicts.data.length === 0) {
    return null;
  }

  return (
    <Card title="Conflito de sincronização" className="border-2 border-warning">
      <Text variant="body">
        Estes registros foram alterados no servidor depois do último download. Os valores deste
        aparelho foram preservados e não serão enviados por cima.
      </Text>
      {conflicts.data.map((record) => (
        <ConflictItem key={record.operationId} record={record} />
      ))}
      <Text variant="caption" tone="muted">
        O aplicativo não resolve conflitos sozinho. Avise o supervisor: a saída é uma ação
        administrativa no servidor ou uma nova inspeção.
      </Text>
    </Card>
  );
}
