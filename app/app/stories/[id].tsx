import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextStoryId, prevStoryId, storyById } from '../../src/stories/stories';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

const SLIDE_MS = 5000;
const SWIPE_DOWN_PX = 80;

export default function StoryViewerScreen() {
  const { id, at } = useLocalSearchParams<{ id: string; at?: string }>();
  const storyId = typeof id === 'string' ? id : '';
  const startAtEnd = at === 'end';
  return <StoryViewer key={`${storyId}:${startAtEnd ? 'end' : 'start'}`} storyId={storyId} startAtEnd={startAtEnd} />;
}

function StoryViewer({ storyId, startAtEnd }: { storyId: string; startAtEnd: boolean }) {
  const story = storyById(storyId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const initialIndex = startAtEnd && story ? Math.max(0, story.slides.length - 1) : 0;
  const [slideIndex, setSlideIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);
  const heldRef = useRef(false);
  const progressRef = useRef(0);
  const slideIndexRef = useRef(initialIndex);

  const close = useCallback(() => {
    router.back();
  }, []);

  const goNext = useCallback(() => {
    const current = storyById(storyId);
    if (!current) return;
    const i = slideIndexRef.current;
    if (i < current.slides.length - 1) {
      slideIndexRef.current = i + 1;
      setSlideIndex(i + 1);
      progressRef.current = 0;
      setProgress(0);
      return;
    }
    const nextId = nextStoryId(current.id);
    if (nextId) {
      router.replace(`/stories/${nextId}` as Href);
      return;
    }
    close();
  }, [storyId, close]);

  const goPrev = useCallback(() => {
    const current = storyById(storyId);
    if (!current) return;
    const i = slideIndexRef.current;
    if (i > 0) {
      slideIndexRef.current = i - 1;
      setSlideIndex(i - 1);
      progressRef.current = 0;
      setProgress(0);
      return;
    }
    const prevId = prevStoryId(current.id);
    if (prevId) {
      router.replace(`/stories/${prevId}?at=end` as Href);
      return;
    }
    close();
  }, [storyId, close]);

  const onZonePressIn = useCallback(() => {
    pausedRef.current = true;
    heldRef.current = false;
  }, []);

  const onZoneLongPress = useCallback(() => {
    heldRef.current = true;
    pausedRef.current = true;
  }, []);

  const onZonePressOut = useCallback(() => {
    pausedRef.current = false;
    // held сбрасываем чуть позже, чтобы onPress после longPress не навигировал
    requestAnimationFrame(() => {
      heldRef.current = false;
    });
  }, []);

  const onLeftPress = useCallback(() => {
    if (heldRef.current) return;
    goPrev();
  }, [goPrev]);

  const onRightPress = useCallback(() => {
    if (heldRef.current) return;
    goNext();
  }, [goNext]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.2,
        onPanResponderGrant: () => {
          pausedRef.current = true;
        },
        onPanResponderRelease: (_e, g) => {
          pausedRef.current = false;
          if (g.dy > SWIPE_DOWN_PX) close();
        },
        onPanResponderTerminate: () => {
          pausedRef.current = false;
        },
      }),
    [close],
  );

  useEffect(() => {
    if (!story) return;
    let alive = true;
    let last = Date.now();
    let raf = 0;

    const tick = () => {
      if (!alive) return;
      const now = Date.now();
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        const next = Math.min(1, progressRef.current + dt / SLIDE_MS);
        progressRef.current = next;
        setProgress(next);
        if (next >= 1) {
          progressRef.current = 0;
          goNext();
          last = Date.now();
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [story, slideIndex, goNext]);

  if (!story) {
    return (
      <View style={[styles.fill, styles.missing]}>
        <Text style={styles.missingText}>История не найдена</Text>
        <Button title="Назад" onPress={close} />
      </View>
    );
  }

  const slide = story.slides[slideIndex]!;
  const hasImage = Boolean(slide.image);
  const textColor = hasImage
    ? lightColors.textOnAccent
    : (slide.textColor ?? lightColors.text);

  return (
    <View style={[styles.fill, { backgroundColor: slide.bg }]} {...panResponder.panHandlers}>
      {slide.image ? (
        <Image source={slide.image} style={styles.bgImage} resizeMode="cover" />
      ) : null}
      {hasImage ? (
        <>
          <View style={styles.scrimTop} pointerEvents="none" />
          <View style={styles.scrimBottom} pointerEvents="none" />
        </>
      ) : null}

      <View style={styles.copy} pointerEvents="none">
        <Text style={[styles.slideTitle, { color: textColor }]}>{slide.title}</Text>
        <Text style={[styles.slideBody, { color: textColor }]}>{slide.body}</Text>
      </View>

      {/* Полноэкранные зоны: тап / hold. Кнопки выше по zIndex. */}
      <View style={styles.tapLayer}>
        <Pressable
          style={[styles.tapZone, { width: width * 0.35 }]}
          onPress={onLeftPress}
          onPressIn={onZonePressIn}
          onLongPress={onZoneLongPress}
          delayLongPress={180}
          onPressOut={onZonePressOut}
          accessibilityLabel="Предыдущий слайд"
        />
        <Pressable
          style={styles.tapZoneFlex}
          onPress={onRightPress}
          onPressIn={onZonePressIn}
          onLongPress={onZoneLongPress}
          delayLongPress={180}
          onPressOut={onZonePressOut}
          accessibilityLabel="Следующий слайд"
        />
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space[2] }]} pointerEvents="box-none">
        <View style={styles.bars} pointerEvents="none">
          {story.slides.map((_, i) => (
            <View key={i} style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < slideIndex
                        ? '100%'
                        : i === slideIndex
                          ? `${Math.round(progress * 100)}%`
                          : '0%',
                    backgroundColor: textColor,
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.topRow} pointerEvents="box-none">
          <Text style={[styles.storyTitle, { color: textColor }]} numberOfLines={1} pointerEvents="none">
            {story.title}
          </Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            hitSlop={12}
            style={styles.closeHit}
          >
            <Text style={[styles.close, { color: textColor }]}>✕</Text>
          </Pressable>
        </View>
      </View>

      {slide.cta ? (
        <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + space[5] }]} pointerEvents="box-none">
          <Button
            title={slide.cta.label}
            variant="dark"
            onPress={() => router.replace(slide.cta!.href as Href)}
            style={styles.cta}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bgImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  scrimTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '28%',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    backgroundColor: lightColors.bg,
    padding: space[5],
  },
  missingText: { ...typography.h3, color: lightColors.text },
  copy: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: space[5],
    paddingBottom: space[7] + 56,
    gap: space[3],
    zIndex: 1,
  },
  slideTitle: { ...typography.display, fontSize: 32, lineHeight: 38 },
  slideBody: { ...typography.body, opacity: 0.95, maxWidth: 420 },
  tapLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 2,
  },
  tapZone: { height: '100%' },
  tapZoneFlex: { flex: 1, height: '100%' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space[3], zIndex: 4 },
  bars: { flexDirection: 'row', gap: 4 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[3],
    minHeight: 44,
  },
  storyTitle: { ...typography.label, flex: 1 },
  closeHit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  close: { ...typography.h2, fontSize: 20 },
  ctaWrap: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    bottom: 0,
    zIndex: 4,
  },
  cta: { alignSelf: 'flex-start' },
});
