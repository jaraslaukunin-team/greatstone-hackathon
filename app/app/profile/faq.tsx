import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../src/i18n/useT';
import { Icon } from '../../src/ui/Icon';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.item}>
      <Pressable
        style={styles.question}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <Text style={styles.qText}>{q}</Text>
        <Icon
          name={open ? 'close' : 'chevronRight'}
          size={20}
          color={lightColors.textSecondary}
        />
      </Pressable>
      {open ? <Text style={styles.answer}>{a}</Text> : null}
    </View>
  );
}

export default function FaqScreen() {
  const t = useT();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.faq.title}</Text>
      {t.faq.items.map((item, i) => (
        <FaqItem key={i} q={item.q} a={item.a} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[2], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text, marginBottom: space[2] },
  item: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    overflow: 'hidden',
  },
  question: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space[4],
    minHeight: 56,
    gap: space[3],
  },
  qText: { ...typography.bodyStrong, color: lightColors.text, flex: 1 },
  answer: {
    ...typography.body,
    color: lightColors.textSecondary,
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    paddingTop: 0,
  },
});
