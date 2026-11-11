import { StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';

/**
 * Три «отпечатка» стопкой — графический мотив бренда (фотография на бумаге).
 * Чисто декоративный, скрыт от скринридеров.
 */
const prints = [
  { rotate: '-9deg', left: 0, top: 18, photo: lightColors.fillMint },
  { rotate: '6deg', left: 34, top: 4, photo: lightColors.fillRose },
  { rotate: '-2deg', left: 18, top: 30, photo: lightColors.fillSky },
] as const;

export function PrintStack({ size = 112 }: { size?: number }) {
  const w = size * 0.78;
  const h = size * 0.92;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size + 40, height: size + 36 }}
    >
      {prints.map((p, i) => (
        <View
          key={i}
          style={[
            styles.print,
            { width: w, height: h, left: p.left, top: p.top, transform: [{ rotate: p.rotate }] },
          ]}
        >
          <View style={[styles.photo, { backgroundColor: p.photo }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  print: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 7,
    paddingBottom: 22, // широкое нижнее поле, как у печатной карточки
  },
  photo: { flex: 1, borderRadius: 2 },
});
