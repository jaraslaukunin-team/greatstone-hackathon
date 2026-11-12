import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextStoryId, prevStoryId, storyById } from '../../src/stories/stories';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

const SLIDE_MS = 5000;
const SWIPE_DOWN_PX = 80;
const LEFT_ZONE = 0.35;

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
  const swipedRef = useRef(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
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

  const onTap = useCallback(
    (e: GestureResponderEvent) => {
      if (heldRef.current || swipedRef.current) return;
      const x = e.nativeEvent.locationX;
      if (x < width * LEFT_ZONE) goPrev();
      else goNext();
    },
    [width, goPrev, goNext],
  );

  const onPressIn = useCallback((e: GestureResponderEvent) => {
    pausedRef.current = true;
    heldRef.current = false;
    swipedRef.current = false;
    touchStartX.current = e.nativeEvent.pageX;
    touchStartY.current = e.nativeEvent.pageY;
  }, []);

  const onLongPress = useCallback(() => {
    heldRef.current = true;
    pausedRef.current = true;
  }, []);

  const onPressOut = useCallback(() => {
    pausedRef.current = false;
    requestAnimationFrame(() => {
      heldRef.current = false;
      swipedRef.current = false;
    });
  }, []);

  const onTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      const dy = e.nativeEvent.pageY - touchStartY.current;
      const dx = e.nativeEvent.pageX - touchStartX.current;
      if (dy > SWIPE_DOWN_PX && Math.abs(dy) > Math.abs(dx) * 1.2) {
        if (!swipedRef.current) {
          swipedRef.current = true;
          heldRef.current = true;
          close();
        }
      }
    },
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
    <View style={[styles.fill, { backgroundColor: slide.bg }]}>
      {slide.image ? (
        <Image source={slide.image} style={styles.bgImage} resizeMode="cover" />
      ) : null}

      <Pressable
        style={styles.tapLayer}
        onPress={onTap}
        onPressIn={onPressIn}
        onLongPress={onLongPress}
        delayLongPress={180}
        onPressOut={onPressOut}
        onTouchMove={onTouchMove}
        accessibilityLabel="Листать сторис"
      />

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

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + space[5] }]}
        pointerEvents="box-none"
      >
        <View style={[styles.textCard, !hasImage && styles.textCardPlain]} pointerEvents="box-none">
          <View pointerEvents="none" style={styles.textCopy}>
            <Text style={[styles.slideTitle, { color: textColor }]}>{slide.title}</Text>
            <Text style={[styles.slideBody, { color: textColor }]}>{slide.body}</Text>
          </View>
          {slide.cta ? (
            <Button
              title={slide.cta.label}
              variant="dark"
              onPress={() => router.replace(slide.cta!.href as Href)}
              style={styles.cta}
            />
          ) : null}
        </View>
      </View>
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
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    backgroundColor: lightColors.bg,
    padding: space[5],
  },
  missingText: { ...typography.h3, color: lightColors.text },
  bottom: {
    position: 'absolute',
    left: space[5],
    right: space[5],
    bottom: 0,
    zIndex: 4,
    alignItems: 'flex-start',
  },
  textCard: {
    maxWidth: 420,
    borderRadius: radius.card,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    gap: space[3],
  },
  textCardPlain: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  textCopy: { gap: space[3] },
  slideTitle: { ...typography.display, fontSize: 32, lineHeight: 38 },
  slideBody: { ...typography.body, opacity: 0.95 },
  tapLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
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
  cta: { alignSelf: 'flex-start' },
});
