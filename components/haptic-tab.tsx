import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Pressable } from 'react-native';

// In SDK 58, expo-router vendors its own React Navigation, so importing
// `PlatformPressable` from `@react-navigation/elements` pulls in a *different*
// ThemeContext than the one provided by expo-router's `ThemeProvider`, causing
// a "Couldn't find a theme" error at runtime. Use React Native's `Pressable`
// directly instead — the tab button only needs press handling plus haptics.
type HapticTabProps = Omit<ComponentProps<typeof Pressable>, 'ref'> & {
  href?: string;
};

export function HapticTab({ onPressIn, ...props }: HapticTabProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
