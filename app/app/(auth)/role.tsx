import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useRoleMode } from '../../src/auth/roleStore';
import { BackButton } from '../../src/ui/BackButton';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Wordmark } from '../../src/ui/Wordmark';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function RoleScreen() {
  const setMode = useRoleMode((s) => s.setMode);

  function choose(mode: 'customer' | 'staff') {
    setMode(mode);
    router.push('/(auth)/login');
  }

  return (
    <View style={styles.screen}>
      <View style={styles.back}>
        <BackButton fallback="/(auth)/welcome" />
      </View>
      <Wordmark />
      <Text style={styles.title}>Кто вы?</Text>
      <Text style={styles.sub}>У клиента и сотрудника разные экраны и разные права.</Text>
      <Card tone="rose">
        <Text style={styles.cardTitle}>Я клиент</Text>
        <Text style={styles.cardSub}>Фотокниги, печать, выпускная фотокнига, AI-редактор, мои заказы.</Text>
        <Button title="Войти как клиент" onPress={() => choose('customer')} />
      </Card>
      <Card tone="sky">
        <Text style={styles.cardTitle}>Я сотрудник «Фотопринт»</Text>
        <Text style={styles.cardSub}>Очередь заказов, смена статусов, обращения, журнал действий.</Text>
        <Button title="Войти как сотрудник" variant="secondary" onPress={() => choose('staff')} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], paddingTop: space[7], gap: space[3] },
  back: { position: 'absolute', top: space[5], left: space[2], zIndex: 1 },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[3] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.h2, color: lightColors.text },
  cardSub: { ...typography.body, color: lightColors.textSecondary, marginVertical: space[2] },
});
