import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface ListProps<TItem> {
  data: readonly TItem[];
  renderItem: (item: TItem, index: number) => ReactNode;
  keyExtractor: (item: TItem, index: number) => string;
  /** Rendered in place of the list when there are no items. */
  empty?: ReactNode;
  className?: string;
}

/**
 * Design system list.
 *
 * A plain mapped list, not a `FlatList`, so it composes inside the scroll view
 * that {@link Screen} already provides without nesting virtualized lists. The
 * empty state is part of the component so every list handles "no items" the
 * same way.
 */
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
