import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { lightColors } from '../theme/theme';

/** Короткая полоска: мягкий стык без «заливки» половины баннера. */
const EDGE_H = 16;

/** [offset, opacity]. Outside: мягкий fade поверх контента. Inside: вуаль внизу headerBackground. */
const STOPS_INSIDE: [string, number][] = [
  ['0', 0],
  ['0.45', 0.28],
  ['1', 0.7],
];
const STOPS_OUTSIDE: [string, number][] = [
  ['0', 1],
  ['0.35', 0.55],
  ['0.7', 0.18],
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
  edge: { height: EDGE_H, width: '100%' },
  inside: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1 },
  // In-flow for height, then pull content up under the fade (не накрывает аватар выше).
  outside: { marginBottom: -EDGE_H, zIndex: 1 },
});
