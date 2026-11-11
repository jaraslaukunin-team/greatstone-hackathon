import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { lightColors, touch } from '../theme/theme';
import { Icon } from './Icon';

/** Кнопка «назад» для шапки и экранов без шапки. Зона касания 44×44. */
export function BackButton({ fallback = '/(tabs)' }: { fallback?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Назад"
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as never))}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Icon name="chevronLeft" size={26} color={lightColors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: touch.min,
    height: touch.min,
    borderRadius: touch.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: lightColors.fillSand },
});
