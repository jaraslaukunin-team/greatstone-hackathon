import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { lightColors } from '../theme/theme';

const EDGE_H = 44;
/** Сколько px градиент заходит вверх в непрозрачную шапку — без стыка-линии. */
const OVERLAP = 14;

/** [offset, opacity]. Снаружи: от сплошного bg к прозрачности. */
const STOPS_INSIDE: [string, number][] = [
  ['0', 0],
  ['0.4', 0.25],
  ['0.75', 0.55],
  ['1', 0.85],
];
const STOPS_OUTSIDE: [string, number][] = [
  ['0', 1],
  ['0.25', 0.7],
  ['0.55', 0.35],
  ['0.8', 0.12],
  ['1', 0],
];

export function HeaderEdge({ inside = false }: { inside?: boolean }) {
  const gradient = useId();
  const stops = inside ? STOPS_INSIDE : STOPS_OUTSIDE;

  return (
    <View pointerEvents="none" style={[styles.edge, inside ? styles.inside : styles.outside]}>
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
  // Верх градиента внутри бара (OVERLAP), низ выступает ниже шапки.
  outside: { bottom: -(EDGE_H - OVERLAP) },
});
