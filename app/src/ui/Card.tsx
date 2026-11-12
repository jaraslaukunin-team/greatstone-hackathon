import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewProps } from 'react-native';
import { lightColors, radius, space } from '../theme/theme';
import { Icon } from './Icon';
import { USE_NATIVE_DRIVER } from './motion';

/**
 * plain — белая карточка с рамкой
 * rose / sand / mint / sky / lilac — цветные подложки из палитры Fills Color
 * green — тёмно-зелёная (для главного блока экрана)
 */
export type CardTone = 'plain' | 'rose' | 'sand' | 'mint' | 'sky' | 'lilac' | 'green';

const tones: Record<CardTone, { backgroundColor: string; borderColor: string }> = {
  plain: { backgroundColor: lightColors.surface, borderColor: lightColors.border },
  rose: { backgroundColor: lightColors.fillRose, borderColor: lightColors.fillRose },
  sand: { backgroundColor: lightColors.fillSand, borderColor: lightColors.fillSand },
  mint: { backgroundColor: lightColors.fillMint, borderColor: lightColors.fillMint },
  sky: { backgroundColor: lightColors.fillSky, borderColor: lightColors.fillSky },
  lilac: { backgroundColor: lightColors.fillLilac, borderColor: lightColors.fillLilac },
  green: { backgroundColor: lightColors.action, borderColor: lightColors.action },
};

type Props = ViewProps & {
  tone?: CardTone;
  chevron?: boolean;
  /** Задержка появления, мс: для ступенчатого списка карточек. */
  delay?: number;
};

export function Card({ tone = 'plain', chevron, delay = 0, style, children, ...rest }: Props) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER });
    a.start();
    return () => a.stop();
  }, [v, delay]);
  const enter = { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  return (
    <Animated.View style={[styles.card, tones[tone], chevron && styles.withChevron, style, enter]} {...rest}>
      {children}
      {chevron ? (
        <View style={styles.chevron}>
          <Icon name="chevronRight" size={24} color={tone === 'green' ? '#FFFFFF' : lightColors.textSecondary} />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
  },
  withChevron: { paddingRight: space[4] + 28 },
  chevron: { position: 'absolute', right: space[3], top: 0, bottom: 0, justifyContent: 'center' },
});
