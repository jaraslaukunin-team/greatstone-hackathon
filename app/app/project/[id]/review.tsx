import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  canProceed,
  checkQualityFallback,
  issueKey,
} from '../../../src/editor/quality';
import { useProjectStore } from '../../../src/project/projectStore';
import { Button } from '../../../src/ui/Button';
import { Card } from '../../../src/ui/Card';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { draft } = useProjectStore();
  const [acked, setAcked] = useState<string[]>([]);

  const issues = useMemo(
    () => (draft ? checkQualityFallback(draft.layout) : []),
    [draft],
  );
  const ready = canProceed(issues, acked);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Проверка перед заказом</Text>
      {issues.length === 0 ? (
        <Text style={styles.sub}>Замечаний нет</Text>
      ) : (
        issues.map((issue) => (
          <Card key={issueKey(issue)}>
            <Text style={styles.cardTitle}>
              {issue.kind === 'empty-cell' ? 'Пустая ячейка' : 'Качество фото'} · стр. {issue.pageIndex + 1}
            </Text>
            <Text style={styles.cardSub}>
              {issue.severity === 'blocker' ? 'Блокирует заказ' : 'Предупреждение'}
            </Text>
            {issue.severity === 'warning' ? (
              <Button
                title="Оставить как есть"
                variant="secondary"
                onPress={() => setAcked((prev) => [...new Set([...prev, issueKey(issue)])])}
              />
            ) : (
              <Button
                title="Исправить"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/project/[id]/overview', params: { id: String(id), page: String(issue.pageIndex) } })
                }
              />
            )}
          </Card>
        ))
      )}
      <Button
        title="Оформить"
        disabled={!ready}
        onPress={() => router.push('/(tabs)/cart')}
      />
      {!ready ? (
        <Text style={styles.hint}>Сначала закройте блокеры и подтвердите предупреждения</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
  hint: { ...typography.caption, color: lightColors.warning },
});
