import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

export const BELOW_HEADER_EDGES = ['bottom', 'left', 'right'] as const;

export interface ScreenProps {
  children: ReactNode;
  scrollable?: boolean;
  edges?: readonly Edge[];
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
