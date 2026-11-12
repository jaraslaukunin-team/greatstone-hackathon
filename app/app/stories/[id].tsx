import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nextStoryId, storyById } from '../../src/stories/stories';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

const SLIDE_MS = 4000;

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const storyId = typeof id === 'string' ? id : '';
  return <StoryViewer key={storyId} storyId={storyId} />;
}

function StoryViewer({ storyId }: { storyId: string }) {
  const story = storyById(storyId);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [slideIndex, setSlideIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);
  const progressRef = useRef(0);
  const slideIndexRef = useRef(0);

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
    router.back();
  }, [storyId]);

  const goPrev = useCallback(() => {
    const i = slideIndexRef.current;
    if (i > 0) {
      slideIndexRef.current = i - 1;
      setSlideIndex(i - 1);
      progressRef.current = 0;
      setProgress(0);
      return;
    }
    router.back();
  }, []);

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
        <Button title="Назад" onPress={() => router.back()} />
      </View>
    );
  }

  const slide = story.slides[slideIndex]!;
  const textColor = slide.textColor ?? lightColors.text;

  return (
    <View style={[styles.fill, { backgroundColor: slide.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + space[2] }]}>
        <View style={styles.bars}>
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
        <View style={styles.topRow}>
          <Text style={[styles.storyTitle, { color: textColor }]} numberOfLines={1}>
            {story.title}
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            hitSlop={12}
            style={styles.closeHit}
          >
            <Text style={[styles.close, { color: textColor }]}>✕</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body} pointerEvents="box-none">
        <Text style={[styles.slideTitle, { color: textColor }]}>{slide.title}</Text>
        <Text style={[styles.slideBody, { color: textColor }]}>{slide.body}</Text>
        {slide.cta ? (
          <Button
            title={slide.cta.label}
            variant="dark"
            onPress={() => router.replace(slide.cta!.href as Href)}
            style={styles.cta}
          />
        ) : null}
      </View>

      <View style={[styles.tapLayer, { bottom: slide.cta ? 120 : 0 }]} pointerEvents="box-none">
        <Pressable
          style={[styles.tapZone, { width: width * 0.35 }]}
          onPress={goPrev}
          onLongPress={() => {
            pausedRef.current = true;
          }}
          onPressIn={() => {
            pausedRef.current = true;
          }}
          onPressOut={() => {
            pausedRef.current = false;
          }}
          accessibilityLabel="Предыдущий слайд"
        />
        <Pressable
          style={styles.tapZoneFlex}
          onPress={goNext}
          onPressIn={() => {
            pausedRef.current = true;
          }}
          onPressOut={() => {
            pausedRef.current = false;
          }}
          accessibilityLabel="Следующий слайд"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    backgroundColor: lightColors.bg,
    padding: space[5],
  },
  missingText: { ...typography.h3, color: lightColors.text },
  top: { paddingHorizontal: space[3], zIndex: 3 },
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
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: space[5],
    paddingBottom: space[7],
    gap: space[3],
    zIndex: 3,
  },
  slideTitle: { ...typography.display, fontSize: 32, lineHeight: 38 },
  slideBody: { ...typography.body, opacity: 0.95, maxWidth: 420 },
  cta: { alignSelf: 'flex-start', marginTop: space[2] },
  tapLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 100,
    flexDirection: 'row',
    zIndex: 2,
  },
  tapZone: { height: '100%' },
  tapZoneFlex: { flex: 1, height: '100%' },
});
