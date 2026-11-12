import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { USE_NATIVE_DRIVER } from './motion';
import { Wordmark } from './Wordmark';

/** Логотип при запуске: плавно появляется и мягко «дышит», пока приложение готовится. */
export function PulseLogo({ height = 44 }: { height?: number }) {
  const appear = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, pulse]);
  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Загрузка"
      style={{
        opacity: appear,
        transform: [
          { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
        ],
      }}
    >
      <Wordmark height={height} />
    </Animated.View>
  );
}
