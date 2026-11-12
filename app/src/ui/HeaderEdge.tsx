import { useId } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { lightColors } from '../theme/theme';

export function HeaderEdge({ inside = false }: { inside?: boolean }) {
  const gradient = useId();
  const blur = Platform.OS === 'web' && !inside ? ({ backdropFilter: 'blur(2px)' } as ViewStyle) : undefined;
  return (
    <View pointerEvents="none" style={[styles.edge, inside ? styles.inside : styles.outside, blur]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor={lightColors.text} stopOpacity={inside ? 0 : 0.09} />
            <Stop offset="1" stopColor={lightColors.text} stopOpacity={inside ? 0.06 : 0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
      </Svg>
    </View>
  );
}

export function HeaderBackground() {
  return <View style={styles.background}><HeaderEdge inside /></View>;
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: lightColors.bg },
  edge: { position: 'absolute', left: 0, right: 0, height: 8, zIndex: 1 },
  inside: { bottom: 0 },
  outside: { top: '100%' },
});
