import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSettingsStore } from '../../src/settings/settingsStore';
import { useT } from '../../src/i18n/useT';
import { Button } from '../../src/ui/Button';
import { PrintStack } from '../../src/ui/PrintStack';
import { lightColors, space, typography } from '../../src/theme/theme';

/**
 * Три приветственных слайда. Показывается один слайд по номеру, без горизонтальной прокрутки:
 * ширина не зависит от окна, поэтому одинаково работает на телефоне и в веб-колонке, а кнопки всегда делают то, что написано.
 */
export default function OnboardingScreen() {
  const t = useT();
  const setOnboardingSeen = useSettingsStore((s) => s.setOnboardingSeen);
  const [current, setCurrent] = useState(0);
  const cards = t.onboarding.cards;
  const card = cards[current]!;
  const isLast = current === cards.length - 1;

  function finish() {
    setOnboardingSeen(true);
    router.replace('/(auth)/welcome');
  }

  function next() {
    if (isLast) finish();
    else setCurrent((i) => i + 1);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.art}>
          <PrintStack size={140} />
        </View>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardBody}>{card.body}</Text>
      </View>

      <View style={styles.dots}>
        {cards.map((_, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1} / ${cards.length}`}
            accessibilityState={{ selected: i === current }}
            onPress={() => setCurrent(i)}
            style={styles.dotHit}
          >
            <View style={[styles.dot, i === current && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title={isLast ? t.onboarding.start : t.onboarding.next} onPress={next} />
        {!isLast ? <Button title={t.onboarding.skip} variant="text" onPress={finish} /> : null}
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
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: space[3] },
  dotHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lightColors.disabledBg,
  },
  dotActive: { backgroundColor: lightColors.accent },
  actions: { paddingHorizontal: space[4], gap: space[1] },
});
