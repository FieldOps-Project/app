import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/** For screens under a navigation header, which already covers the top inset. */
export const BELOW_HEADER_EDGES = ['bottom', 'left', 'right'] as const;

export interface ScreenProps {
  children: ReactNode;
  /** Wraps the content in a scroll view. */
  scrollable?: boolean;
  /** Defaults to all four. Under a header, pass {@link BELOW_HEADER_EDGES}. */
  edges?: readonly Edge[];
  /**
   * Standard padding around the content. Turn off for a full-bleed
   * `FlatList`, which applies it to its own content container instead — a
   * padding override in `className` would lose to these classes.
   */
  padded?: boolean;
  className?: string;
}

export function Screen({
  children,
  scrollable = false,
  edges = ['top', 'bottom', 'left', 'right'],
  padded = true,
  className,
}: ScreenProps) {
  const content = (
    <View className={`flex-1 gap-4 ${padded ? 'px-screen py-4' : ''} ${className ?? ''}`}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      {scrollable ? (
        <ScrollView
          contentContainerClassName="grow"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
