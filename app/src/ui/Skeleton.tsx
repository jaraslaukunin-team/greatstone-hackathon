import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { lightColors, radius, space } from '../theme/theme';
import { USE_NATIVE_DRIVER } from './motion';

/** Серый блок-заглушка, который мягко «дышит», пока грузятся данные. */
export function Skeleton({
  width = '100%',
  height = 16,
  round = 8,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: round, backgroundColor: lightColors.border },
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }) },
        style,
      ]}
    />
  );
}

/** Карточка-скелет в форме карточки каталога/заказа: заголовок, строка описания, плашки и цена. */
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="55%" height={22} />
      <Skeleton width="90%" height={14} style={styles.gap} />
      <View style={[styles.row, styles.gap]}>
        <Skeleton width={64} height={22} round={999} />
        <Skeleton width={64} height={22} round={999} />
      </View>
      <Skeleton width="35%" height={20} style={styles.gap} />
    </View>
  );
}

/** Экран-скелет списка: заголовок, подзаголовок и несколько карточек. */
export function ListSkeleton({ count = 3, withTitle = true }: { count?: number; withTitle?: boolean }) {
  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Загрузка">
      {withTitle ? (
        <>
          <Skeleton width="48%" height={30} />
          <Skeleton width="70%" height={14} />
        </>
      ) : null}
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

export function BookSkeleton() {
  return (
    <View style={styles.screen} accessibilityRole="progressbar" accessibilityLabel="Загрузка">
      <Skeleton width="35%" height={32} />
      <Skeleton width="60%" height={16} />
      <Skeleton width="100%" height={44} />
      <View style={styles.spread}>
        <Skeleton width="49%" height="100%" />
        <Skeleton width="49%" height="100%" />
      </View>
      <Skeleton width="100%" height={48} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: space[4], gap: space[3], backgroundColor: lightColors.bg },
  spread: { flexDirection: 'row', justifyContent: 'space-between', aspectRatio: 2, width: '100%' },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
    padding: space[4],
  },
  row: { flexDirection: 'row', gap: space[1] },
  gap: { marginTop: space[2] },
});
