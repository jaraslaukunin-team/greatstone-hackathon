import { StyleSheet, Text, type TextStyle } from 'react-native';
import { lightColors, typography } from '../theme/theme';

/**
 * Временный текстовый логотип. Фирменный рукописный логотип — векторный файл из
 * брендбука (стр. 4–8); как только он появится в assets, заменить этот компонент на SVG.
 * Логотип нельзя вращать, растягивать, обводить и добавлять тени (брендбук, стр. 6).
 */
export function Wordmark({ color = lightColors.accent, size = 28 }: { color?: string; size?: number }) {
  const style: TextStyle = { fontSize: size, lineHeight: size * 1.15, color };
  return (
    <Text accessibilityRole="header" accessibilityLabel="Pic Pac" style={[styles.mark, style]}>
      picPac
    </Text>
  );
}

const styles = StyleSheet.create({
  mark: {
    ...typography.h1,
    letterSpacing: -0.5,
  },
});
