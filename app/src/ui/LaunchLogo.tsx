import { useEffect, useId, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { lightColors } from '../theme/theme';
import { logoAspect, logoPaths, logoViewBox } from './logoPaths';

const WIDTH = 1156;
const HEIGHT = 652;
const DURATION = 720;
const HOLD = 100;

export function LaunchLogo({ onFinish }: { onFinish: () => void }) {
  const [progress, setProgress] = useState(0);
  const clipId = `launch-logo-${useId().replace(/[^a-z0-9_-]/gi, '')}`;

  useEffect(() => {
    let active = true;
    let frame = 0;
    let hold: ReturnType<typeof setTimeout> | undefined;
    function start(reduced: boolean) {
      if (!active) return;
      if (reduced) {
        onFinish();
        return;
      }
      let started: number | undefined;
      function tick(now: number) {
        started ??= now;
        const elapsed = Math.min(1, (now - started) / DURATION);
        setProgress(1 - (1 - elapsed) ** 2);
        if (elapsed < 1) frame = requestAnimationFrame(tick);
        else hold = setTimeout(onFinish, HOLD);
      }
      frame = requestAnimationFrame(tick);
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(start, () => start(false));
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(hold);
    };
  }, [onFinish]);

  return (
    <View style={styles.overlay} accessibilityRole="progressbar" accessibilityLabel="Загрузка">
      <Svg width={112 * logoAspect} height={112} viewBox={logoViewBox}>
        <Defs>
          <ClipPath id={clipId}>
            <Rect x={0} y={0} width={progress * WIDTH} height={HEIGHT} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          {logoPaths.map(({ d, evenOdd, fill }, index) => (
            <Path key={index} d={d} fill={fill ?? '#364b49'} fillRule={evenOdd ? 'evenodd' : 'nonzero'} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: lightColors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
