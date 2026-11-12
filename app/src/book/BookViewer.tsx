import type { BookTheme, Layout, Rect } from '@picpac/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, lightColors, radius, space, typography } from '../theme/theme';
import { nextIndex, spreadsOf } from './flip';
import type { SourceOf } from './imageSource';
import { PageView } from './PageView';

type Props = {
  title: string;
  layout: Layout;
  sourceOf: SourceOf;
  theme: BookTheme;
  /** Тап по странице: индекс страницы и её прямоугольник в окне (для анимации увеличения). */
  onOpenPage?: (pageIndex: number, rect: Rect) => void;
  /** Разворот сменился: нужен просмотру результата, чтобы показать «Заказать» на последнем. */
  onIndexChange?: (index: number, total: number) => void;
  /** Перейти к развороту (например, по тапу на миниатюру); key нужен, чтобы повторный переход к тому же развороту сработал. */
  jumpTo?: { index: number; key: number };
};

const FLIP_MS = 450;

/**
 * Листание книги: обложка, затем развороты. Переворот страницы поворачивает лист вокруг корешка;
 * при включённом «уменьшении движения» разворот меняется без анимации.
 */
export function BookViewer({ title, layout, sourceOf, theme, onOpenPage, onIndexChange, jumpTo }: Props) {
  const spreads = useMemo(() => spreadsOf(layout.pages.length), [layout.pages.length]);
  // Типы View в RN 0.88 не знают measureInWindow через ref, поэтому описываем нужный кусок сами.
  const bookRef = useRef<{ measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void } | null>(null);
  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState<{ from: number; to: number } | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);
  useEffect(() => {
    onIndexChange?.(index, spreads.length);
  }, [index, spreads.length, onIndexChange]);
  // Переход по тапу на миниатюру: без переворота, сразу к нужному развороту.
  useEffect(() => {
    if (jumpTo) setIndex(Math.min(spreads.length - 1, Math.max(0, jumpTo.index)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.key]);
  // Если страниц стало меньше (удалили страницу), индекс не должен выйти за книгу.
  useEffect(() => {
    setIndex((i) => Math.min(i, spreads.length - 1));
  }, [spreads.length]);

  const pageW = boxWidth / 2;
  const pageH = pageW; // страницы квадратные: форматы книги в каталоге близки к квадрату

  function go(dir: 1 | -1) {
    if (busy.current) return;
    const to = nextIndex(index, spreads.length, dir);
    if (to === index) return;
    if (reduceMotion || boxWidth === 0) {
      setIndex(to);
      return;
    }
    busy.current = true;
    progress.setValue(0);
    setFlip({ from: index, to });
    Animated.timing(progress, { toValue: 1, duration: FLIP_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
      setIndex(to);
      setFlip(null);
      busy.current = false;
    });
  }

  const goRef = useRef(go);
  goRef.current = go;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          if (g.dx < -40) goRef.current(1);
          else if (g.dx > 40) goRef.current(-1);
        },
      }),
    [],
  );

  const page = (i: number | null) => (i === null ? null : (layout.pages[i] ?? null));
  const view = (i: number | null) => (
    <PageView page={page(i)} sourceOf={sourceOf} width={pageW} height={pageH} theme={theme} />
  );
  // Страниц могло стать меньше прямо сейчас (удалили страницу): индекс подтянется эффектом, а этот кадр не должен упасть.
  const [curL, curR] = spreads[Math.min(index, spreads.length - 1)]!;

  // Тап по странице: сообщаем её индекс и положение в окне, чтобы правка «выросла» из этого места.
  function openPage(fromRight = curR !== null) {
    const p = fromRight ? curR : curL;
    if (p === null || !onOpenPage) return;
    bookRef.current?.measureInWindow((x, y, w, h) => {
      onOpenPage(p, { x: fromRight ? x + w / 2 : x, y, width: w / 2, height: h });
    });
  }

  const titleStyle = { fontFamily: fonts[theme.titleFont], color: theme.titleColor };
  const target = flip ? spreads[flip.to]! : null;
  const forward = flip ? flip.to > flip.from : true;

  // Лист переворачивается вокруг корешка: вперёд — правая страница, назад — левая.
  const angle = progress.interpolate({ inputRange: [0, 1], outputRange: forward ? ['0deg', '-180deg'] : ['0deg', '180deg'] });
  const hinge = forward ? -pageW / 2 : pageW / 2;
  const sheetStyle = {
    position: 'absolute' as const,
    top: 0,
    width: pageW,
    height: pageH,
    left: forward ? pageW : 0,
    transform: [{ perspective: 1400 }, { translateX: hinge }, { rotateY: angle }, { translateX: -hinge }],
  };

  const leftContent = flip ? (forward ? view(curL) : view(target![0])) : view(curL);
  const rightContent = flip ? (forward ? view(target![1]) : view(curR)) : view(curR);
  const isCover = index === 0 && !flip;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`Книга «${title}», разворот ${index + 1} из ${spreads.length}`}
      {...pan.panHandlers}
    >
      <View ref={bookRef as never} collapsable={false} style={[styles.book, { height: pageH }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Править левую страницу"
          disabled={isCover || curL === null}
          onPress={() => openPage(false)}
          style={[styles.half, { width: pageW, height: pageH }]}
        >
          {isCover ? <View style={[styles.sheet, { width: pageW, height: pageH }]} /> : leftContent}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isCover ? 'Править первую страницу' : 'Править правую страницу'}
          disabled={curR === null}
          onPress={() => openPage(true)}
          style={[styles.half, { width: pageW, height: pageH }]}
        >
          {isCover ? (
            <View style={[styles.cover, { width: pageW, height: pageH, backgroundColor: theme.coverBg }]}>
              {theme.cover === 'full-photo' && curR !== null && page(curR) ? view(curR) : null}
              {theme.cover === 'framed-photo' && curR !== null && page(curR) ? (
                <View style={{ position: 'absolute', left: pageW * 0.1, top: pageH * 0.08, width: pageW * 0.8, height: pageH * 0.68 }}>
                  <PageView page={page(curR)} sourceOf={sourceOf} width={pageW * 0.8} height={pageH * 0.68} theme={theme} />
                </View>
              ) : null}
              <View
                style={[
                  styles.coverTitle,
                  theme.cover === 'full-photo' ? styles.coverShade : null,
                  theme.cover === 'color-title' ? styles.coverTitleCenter : null,
                ]}
                pointerEvents="none"
              >
                <Text style={[styles.coverText, titleStyle]} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            </View>
          ) : (
            rightContent
          )}
        </Pressable>
        {flip ? (
          <Animated.View style={sheetStyle} pointerEvents="none">
            <View style={[styles.face, styles.front]}>{view(forward ? curR : curL)}</View>
            <View style={[styles.face, styles.back]}>{view(forward ? target![0] : target![1])}</View>
          </Animated.View>
        ) : null}
        <View style={styles.spine} pointerEvents="none" />
      </View>

      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={() => go(-1)} style={[styles.arrow, index === 0 && styles.arrowOff]}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Открыть страницу в редакторе"
          onPress={() => openPage()}
        >
          <Text style={styles.counter}>
            {index === 0 ? 'Обложка' : `Разворот ${index} из ${spreads.length - 1}`}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Вперёд"
          onPress={() => go(1)}
          style={[styles.arrow, index === spreads.length - 1 && styles.arrowOff]}
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: space[3] },
  book: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: lightColors.border,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  half: { overflow: 'hidden' },
  sheet: { backgroundColor: 'transparent' },
  cover: { backgroundColor: lightColors.action, overflow: 'hidden', justifyContent: 'flex-end' },
  coverTitle: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space[3] },
  coverShade: { backgroundColor: 'rgba(0,0,0,0.45)' },
  coverTitleCenter: { top: 0, justifyContent: 'center', alignItems: 'center' },
  coverText: { ...typography.h2 },
  face: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: 'hidden' },
  front: {},
  back: { transform: [{ rotateY: '180deg' }] },
  spine: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1, backgroundColor: 'rgba(0,0,0,0.18)' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOff: { opacity: 0.35 },
  arrowText: { ...typography.h1, color: lightColors.text, lineHeight: 34 },
  counter: { ...typography.bodyStrong, color: lightColors.text, minHeight: 44, textAlignVertical: 'center', paddingTop: 12 },
});
