import { usePathname } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

/** Параметры перехода: лёгкое проявление без сдвига, чтобы шапка и нижняя панель не «ездили». */
export const ROUTE_ANIMATION = { duration: 220, from: 0.55 } as const;

function WebRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    v.setValue(0);
    const a = Animated.timing(v, {
      toValue: 1,
      duration: ROUTE_ANIMATION.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [pathname, v]);
  return (
    <Animated.View
      style={[
        styles.fill,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [ROUTE_ANIMATION.from, 1] }) },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Анимация смены экрана. На телефоне её делает сам навигатор (slide/fade), а на вебе у навигатора
 * переходов нет, поэтому плавно проявляем содержимое при смене адреса.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebRouteTransition>{children}</WebRouteTransition>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
