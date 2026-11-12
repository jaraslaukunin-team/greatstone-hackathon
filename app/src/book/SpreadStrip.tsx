import type { BookTheme, Layout } from '@picpac/shared';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { spreadsOf } from './flip';
import type { SourceOf } from './imageSource';
import { PageView } from './PageView';
import type { SpreadIssue } from './spreadIssues';

type Props = {
  layout: Layout;
  sourceOf: SourceOf;
  theme: BookTheme;
  /** Проблемы по разворотам (spreadIssues), по порядку разворотов. */
  issues: SpreadIssue[][];
  currentIndex: number;
  onSelect(spreadIndex: number): void;
  /** Сдвинуть выбранный разворот: −1 назад, 1 вперёд. Обложка не двигается. */
  onMove(spreadIndex: number, dir: -1 | 1): void;
};

const THUMB = 44;

/** Лента миниатюр разворотов: тап — перейти, значки — что не так, кнопки — переставить выбранный разворот. */
export function SpreadStrip({ layout, sourceOf, theme, issues, currentIndex, onSelect, onMove }: Props) {
  const spreads = useMemo(() => spreadsOf(layout.pages.length), [layout.pages.length]);
  const movable = currentIndex >= 1;
  const canBack = movable && currentIndex > 1;
  const canForward = movable && currentIndex < spreads.length - 1;

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {spreads.map(([left, right], index) => {
          const selected = index === currentIndex;
          const problems = issues[index] ?? [];
          const label = index === 0 ? 'Обложка' : `Разворот ${index}`;
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}${problems.includes('empty') ? ', есть пустые места' : ''}${problems.includes('blurry') ? ', фото могут быть нерезкими' : ''}`}
              onPress={() => onSelect(index)}
              style={[styles.item, selected && styles.itemOn]}
            >
              <View style={styles.pair}>
                <PageView page={left === null ? null : (layout.pages[left] ?? null)} sourceOf={sourceOf} width={THUMB} height={THUMB} theme={theme} />
                <PageView page={right === null ? null : (layout.pages[right] ?? null)} sourceOf={sourceOf} width={THUMB} height={THUMB} theme={theme} />
              </View>
              <Text style={[styles.caption, selected && styles.captionOn]}>{index === 0 ? 'Обл.' : index}</Text>
              {problems.length > 0 ? (
                <View style={[styles.badge, problems.includes('empty') ? styles.badgeEmpty : styles.badgeBlurry]} pointerEvents="none">
                  <Text style={styles.badgeText}>!</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {movable ? (
        <View style={styles.moveRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Переместить разворот назад" disabled={!canBack} onPress={() => onMove(currentIndex, -1)} style={[styles.move, !canBack && styles.off]}>
            <Text style={styles.moveText}>◀ Раньше</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Переместить разворот вперёд" disabled={!canForward} onPress={() => onMove(currentIndex, 1)} style={[styles.move, !canForward && styles.off]}>
            <Text style={styles.moveText}>Позже ▶</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  row: { gap: space[2], paddingVertical: space[1] },
  item: { minWidth: THUMB * 2 + 8, padding: 4, borderRadius: radius.photo * 2, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', gap: 2 },
  itemOn: { borderColor: lightColors.accent },
  pair: { flexDirection: 'row', borderRadius: radius.photo, overflow: 'hidden', backgroundColor: lightColors.border },
  caption: { ...typography.label, color: lightColors.textSecondary },
  captionOn: { color: lightColors.text },
  badge: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeEmpty: { backgroundColor: lightColors.danger },
  badgeBlurry: { backgroundColor: lightColors.warning },
  badgeText: { ...typography.label, color: '#FFFFFF', lineHeight: 16 },
  moveRow: { flexDirection: 'row', gap: space[2] },
  move: { flex: 1, minHeight: 44, borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  moveText: { ...typography.bodyStrong, color: lightColors.text },
  off: { opacity: 0.4 },
});
