import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/**
 * Safe area edges for a screen rendered under a navigation header.
 *
 * The header already covers the top inset, so repeating it here would push the
 * content down twice.
 */
export const BELOW_HEADER_EDGES = ['bottom', 'left', 'right'] as const;

export interface ScreenProps {
  children: ReactNode;
  /**
   * Wraps the content in a scroll view. Defaults to `false`.
   *
   * Form and checklist screens grow beyond the usable height of the device,
   * especially with the keyboard open.
   */
  scrollable?: boolean;
  /**
   * Safe area edges to respect. Defaults to all four.
   *
   * Routes that show their own header should pass
   * `['bottom', 'left', 'right']`, since the header covers the top edge.
   */
  edges?: readonly Edge[];
  /** Extra utility classes applied to the content container. */
  className?: string;
}

/**
 * Default screen container providing safe area, background color and
 * horizontal padding.
 */
export function Screen({
  children,
  scrollable = false,
  edges = ['top', 'bottom', 'left', 'right'],
  className,
}: ScreenProps) {
  const content = (
    <View className={`flex-1 gap-4 px-screen py-4 ${className ?? ''}`}>{children}</View>
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
