import { useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { clampSplit, stepSplit } from './sliderMath';

type Props = {
  beforeUri: string;
  afterUri: string;
  /** Ширина к высоте области просмотра; фото внутри вписываются целиком, без растяжения. */
  aspect: number;
};

/** Сравнение «до/после»: слева исходник, справа результат, границу тянут пальцем или стрелками. */
export function BeforeAfterSlider({ beforeUri, afterUri, aspect }: Props) {
  const [width, setWidth] = useState(0);
  const [split, setSplit] = useState(0.5);
  const box = useRef<{ measureInWindow?: (cb: (x: number) => void) => void } | null>(null);
  const left = useRef(0);
  const widthRef = useRef(0);

  const measure = () =>
    box.current?.measureInWindow?.((x: number) => {
      left.current = x;
    });

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder.create registers these callbacks and reads the refs only during gestures.
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          measure();
          setSplit(clampSplit(g.x0 - left.current, widthRef.current));
        },
        onPanResponderMove: (_e, g) => setSplit(clampSplit(g.moveX - left.current, widthRef.current)),
      }),
    [],
  );

  function onLayout(e: LayoutChangeEvent) {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
    measure();
  }

  const keyProps = {
    focusable: true,
    onKeyDown: (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'ArrowLeft') setSplit((s) => stepSplit(s, -1));
      if (e.nativeEvent.key === 'ArrowRight') setSplit((s) => stepSplit(s, 1));
    },
  } as object;

  return (
    <View
      ref={box as never}
      onLayout={onLayout}
      style={[styles.box, { aspectRatio: aspect }]}
      accessibilityRole="adjustable"
      accessibilityLabel="Сравнение до и после"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(split * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => setSplit((s) => stepSplit(s, e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      {...keyProps}
      {...responder.panHandlers}
    >
      <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <View style={[styles.clip, { width: width * split }]} pointerEvents="none">
        <Image source={{ uri: beforeUri }} style={[styles.before, { width }]} resizeMode="contain" />
      </View>
      <View style={[styles.handle, { left: width * split - 1 }]} pointerEvents="none">
        <View style={styles.knob} />
      </View>
      <Text style={[styles.tag, styles.tagLeft]}>До</Text>
      <Text style={[styles.tag, styles.tagRight]}>После</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: lightColors.border },
  clip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden', backgroundColor: lightColors.border },
  before: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  knob: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: lightColors.text },
  tag: {
    position: 'absolute',
    top: space[2],
    ...typography.caption,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  tagLeft: { left: space[2] },
  tagRight: { right: space[2] },
});
