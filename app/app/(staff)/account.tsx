import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRoleMode } from '../../src/auth/roleStore';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function StaffAccountScreen() {
  const { user, logout } = useAuth();
  const setMode = useRoleMode((s) => s.setMode);
  return (
    <View style={styles.screen}>
      <Text style={styles.name}>{user?.displayName ?? 'Сотрудник'}</Text>
      <Text style={styles.sub}>Роль: оператор «Фотопринт»</Text>
      <Text style={styles.sub}>Сотрудник видит заказы, обращения и журнал. Каталога, корзины и AI в этом режиме нет.</Text>
      <Button
        title="Выйти"
        onPress={() => {
          setMode(null);
          void logout().then(() => router.replace('/(auth)/role'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  name: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
});
