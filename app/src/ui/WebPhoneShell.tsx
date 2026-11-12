import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { lightColors } from '../theme/theme';

/** Ширина «телефонной» колонки на широком web. */
export const WEB_PHONE_WIDTH = 430;

/**
 * На web-десктопе (ширина > 430) показывает тот же UI колонкой по центру.
 * На телефоне и native — без изменений.
 */
export function WebPhoneShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== 'web' || width <= WEB_PHONE_WIDTH) {
    return <>{children}</>;
  }

  return (
    <View style={styles.outer}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: lightColors.surfaceMuted,
    alignItems: 'center',
  },
  column: {
    width: WEB_PHONE_WIDTH,
    maxWidth: '100%',
    flex: 1,
    alignSelf: 'center',
    backgroundColor: lightColors.bg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: lightColors.border,
    overflow: 'hidden',
  },
});
