import { useId } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { lightColors } from '../theme/theme';

const EDGE_H = 28;

/** Точки градиента: [позиция, прозрачность]. Внутри шапки тонкая вуаль снизу, снаружи плавное затухание вниз. */
const STOPS_INSIDE: [string, number][] = [['0', 0], ['0.45', 0.35], ['1', 0.72]];
const STOPS_OUTSIDE: [string, number][] = [['0', 0.78], ['0.35', 0.42], ['0.7', 0.14], ['1', 0]];

export function HeaderEdge({ inside = false }: { inside?: boolean }) {
  const gradient = useId();
  const stops = inside ? STOPS_INSIDE : STOPS_OUTSIDE;
  const blur =
    Platform.OS === 'web' && !inside
      ? ({
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          maskImage: 'linear-gradient(to bottom, #000 0%, #000 18%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 18%, transparent 100%)',
        } as ViewStyle)
      : undefined;

  return (
    <View pointerEvents="none" style={[styles.edge, inside ? styles.inside : styles.outside, blur]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor={lightColors.bg} stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
      </Svg>
    </View>
  );
}

export function HeaderBackground() {
  return (
    <View style={styles.background}>
      <HeaderEdge inside />
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: lightColors.bg },
  edge: { position: 'absolute', left: 0, right: 0, height: EDGE_H, zIndex: 1 },
  inside: { bottom: 0 },
  outside: { top: '100%' },
});
