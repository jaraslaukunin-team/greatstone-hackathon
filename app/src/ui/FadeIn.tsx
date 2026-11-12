import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { USE_NATIVE_DRIVER } from './motion';

type Props = {
  children: React.ReactNode;
  /** Задержка перед появлением, мс (для ступенчатого списка). */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Плавное появление: прозрачность 0→1 и подъём на 12 пунктов. Играет один раз при показе. */
export function FadeIn({ children, delay = 0, style }: Props) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
