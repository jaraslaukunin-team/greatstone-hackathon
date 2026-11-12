import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lightColors, space, typography } from '../theme/theme';
import { STORIES } from './stories';

const TILE_W = 92;
const TILE_H = 78;
const TILE_RADIUS = 14;

/** Горизонтальная лента сторис компании на главной. */
export function StoriesStrip() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
      accessibilityLabel="Истории PicPac"
    >
      {STORIES.map((story) => (
        <Link key={story.id} href={`/stories/${story.id}`} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`История: ${story.title}`}
            style={styles.item}
          >
            <View style={[styles.tileOuter, { borderColor: story.accent }]}>
              <View style={[styles.tile, { backgroundColor: story.accent }]}>
                <Text style={styles.mark}>{story.mark}</Text>
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {story.title}
            </Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: space[2],
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  item: {
    width: TILE_W,
    alignItems: 'center',
    gap: 3,
  },
  tileOuter: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: TILE_RADIUS,
    borderWidth: 2,
    padding: 2,
  },
  tile: {
    flex: 1,
    borderRadius: TILE_RADIUS - 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    ...typography.h2,
    color: lightColors.textOnAccent,
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 16,
    color: lightColors.text,
    textAlign: 'center',
    width: '100%',
  },
});
