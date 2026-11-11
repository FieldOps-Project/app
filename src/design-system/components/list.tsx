import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface ListProps<TItem> {
  data: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  keyExtractor: (item: TItem, index: number) => string;
  empty?: ReactNode;
  className?: string;
}

export function List<TItem>({
  data,
  renderItem,
  keyExtractor,
  empty,
  className,
}: ListProps<TItem>) {
  if (data.length === 0) {
    return <>{empty}</>;
  }

  return (
    <View className={`gap-3 ${className ?? ''}`}>
      {data.map((item, index) => (
        <View key={keyExtractor(item, index)}>{renderItem(item, index)}</View>
      ))}
    </View>
  );
}
