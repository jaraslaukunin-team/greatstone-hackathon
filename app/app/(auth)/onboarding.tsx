import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSettingsStore } from '../../src/settings/settingsStore';
import { useT } from '../../src/i18n/useT';
import { Button } from '../../src/ui/Button';
import { PrintStack } from '../../src/ui/PrintStack';
import { lightColors, space, typography } from '../../src/theme/theme';

const { width: SCREEN_W } = Dimensions.get('window');

function OnboardingCard({ title, body, index }: { title: string; body: string; index: number }) {
  return (
    <View style={[styles.card, { width: SCREEN_W }]}>
      <View style={styles.art}>
        <PrintStack size={140} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const t = useT();
  const setOnboardingSeen = useSettingsStore((s) => s.setOnboardingSeen);
  const [current, setCurrent] = useState(0);
  const listRef = useRef<FlatList>(null);
  const cards = t.onboarding.cards;

  function finish() {
    setOnboardingSeen(true);
    router.replace('/(auth)/welcome');
  }

  function next() {
    if (current < cards.length - 1) {
      listRef.current?.scrollToIndex({ index: current + 1, animated: true });
    } else {
      finish();
    }
  }

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index?: number | null; item: unknown }[] }) => {
      const first = viewableItems[0];
      if (first != null && first.index != null) {
        setCurrent(first.index);
      }
    },
    [],
  );

  const isLast = current === cards.length - 1;

  return (
    <View style={styles.screen}>
      <FlatList
        ref={listRef}
        data={cards}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <OnboardingCard title={item.title} body={item.body} index={index} />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        style={styles.list}
      />

      <View style={styles.dots}>
        {cards.map((_, i) => (
          <View key={i} style={[styles.dot, i === current && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        <Button
          title={isLast ? t.onboarding.start : t.onboarding.next}
          onPress={next}
        />
        {!isLast ? (
          <Button title={t.onboarding.skip} variant="text" onPress={finish} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    paddingBottom: space[5],
  },
  list: { flex: 1 },
  card: {
    flex: 1,
    padding: space[4],
    paddingTop: space[7],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
  },
  art: { marginBottom: space[3] },
  cardTitle: { ...typography.h1, color: lightColors.text, textAlign: 'center' },
  cardBody: {
    ...typography.body,
    color: lightColors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: space[4],
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space[2], marginBottom: space[4] },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lightColors.disabledBg,
  },
  dotActive: { backgroundColor: lightColors.accent },
  actions: { paddingHorizontal: space[4], gap: space[1] },
});
