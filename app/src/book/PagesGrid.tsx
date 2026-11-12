import type { BookTheme, Layout } from '@picpac/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { CoverView } from './CoverView';
import { coverPage, coverTitle } from './cover';
import { spreadsOf } from './flip';
import type { SourceOf } from './imageSource';
import { PageView } from './PageView';
import { pageTiles } from './spreadInfo';
import type { SpreadIssue } from './spreadIssues';

type Props = {
  layout: Layout;
  projectTitle: string;
  sourceOf: SourceOf;
  theme: BookTheme;
  issues: SpreadIssue[][];
  /** Выбранный разворот (подсвечивается). */
  currentIndex: number;
  /** Тап по плитке: для обложки приходит kind = 'cover'. */
  onSelect(spreadIndex: number, kind: 'cover' | 'spread'): void;
};

const W = 64;

/** Сетка миниатюр книги: обложка и все развороты, с отметкой замечаний. */
export function PagesGrid({ layout, projectTitle, sourceOf, theme, issues, currentIndex, onSelect }: Props) {
  const tiles = pageTiles(layout, issues);
  const spreads = spreadsOf(layout.pages.length);
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const spread = spreads[tile.spreadIndex] ?? [null, null];
        const selected = tile.kind === 'spread' && tile.spreadIndex === currentIndex;
        const problems = tile.issues;
        return (
          <Pressable
            key={`${tile.kind}-${tile.spreadIndex}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tile.caption}${problems.includes('empty') ? ', есть пустые места' : ''}${problems.includes('blurry') ? ', фото могут быть нерезкими' : ''}`}
            onPress={() => onSelect(tile.spreadIndex, tile.kind)}
            style={[styles.tile, selected && styles.tileOn]}
          >
            {tile.kind === 'cover' ? (
              <CoverView
                title={coverTitle(layout, projectTitle)}
                subtitle={layout.cover?.subtitle}
                page={coverPage(layout)}
                sourceOf={sourceOf}
                theme={theme}
                color={layout.cover?.color}
                width={W}
                height={W}
              />
            ) : (
              <View style={styles.pair}>
                <PageView page={spread[0] === null ? null : (layout.pages[spread[0]] ?? null)} sourceOf={sourceOf} width={W} height={W} theme={theme} />
                <PageView page={spread[1] === null ? null : (layout.pages[spread[1]] ?? null)} sourceOf={sourceOf} width={W} height={W} theme={theme} />
              </View>
            )}
            <Text style={[styles.caption, selected && styles.captionOn]}>{tile.caption}</Text>
            {problems.length > 0 ? (
              <View style={[styles.badge, problems.includes('empty') ? styles.badgeEmpty : styles.badgeBlurry]} pointerEvents="none">
                <Text style={styles.badgeText}>!</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' },
  tile: { minWidth: W * 2 + 12, minHeight: 44, padding: 6, borderRadius: radius.photo * 2, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', gap: 4, backgroundColor: lightColors.surface },
  tileOn: { borderColor: lightColors.accent },
  pair: { flexDirection: 'row', borderRadius: radius.photo, overflow: 'hidden', backgroundColor: lightColors.border },
  caption: { ...typography.label, color: lightColors.textSecondary },
  captionOn: { color: lightColors.accent },
  badge: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeEmpty: { backgroundColor: lightColors.danger },
  badgeBlurry: { backgroundColor: lightColors.warning },
  badgeText: { ...typography.label, color: '#FFFFFF', lineHeight: 16 },
});
