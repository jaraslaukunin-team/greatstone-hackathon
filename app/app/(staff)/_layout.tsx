import { Redirect, Tabs, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { canEnterStaff } from '../../src/auth/roleMode';
import { useRoleMode } from '../../src/auth/roleStore';
import { Button } from '../../src/ui/Button';
import { Icon, type IconName } from '../../src/ui/Icon';
import { lightColors, space, typography } from '../../src/theme/theme';

const items: ReadonlyArray<{ name: string; title: string; icon: IconName }> = [
  { name: 'index', title: 'Заказы', icon: 'doc' },
  { name: 'inbox', title: 'Обращения', icon: 'info' },
  { name: 'audit', title: 'Журнал', icon: 'lock' },
  { name: 'account', title: 'Профиль', icon: 'user' },
];

function NoAccess() {
  const { logout } = useAuth();
  const setMode = useRoleMode((s) => s.setMode);
  return (
    <View style={styles.denied}>
      <Text style={styles.deniedTitle}>У этого аккаунта нет доступа сотрудника</Text>
      <Text style={styles.deniedText}>Раздел сотрудника открывается только аккаунтам с ролью «оператор».</Text>
      <Button
        title="Войти как клиент"
        onPress={() => {
          setMode('customer');
          router.replace('/(tabs)');
        }}
      />
      <Button
        title="Выйти"
        variant="text"
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/role'));
        }}
      />
    </View>
  );
}

export default function StaffLayout() {
  const { user, token, ready } = useAuth();
  const mode = useRoleMode((s) => s.mode);
  if (!ready) return null;
  if (!token) return <Redirect href="/(auth)/role" />;
  if (!canEnterStaff(mode, user)) return <NoAccess />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: lightColors.bg },
        headerTitleStyle: { ...typography.h2, color: lightColors.text },
        tabBarActiveTintColor: lightColors.text,
        tabBarInactiveTintColor: lightColors.textSecondary,
        tabBarStyle: { backgroundColor: lightColors.surface, borderTopColor: lightColors.border, height: 72, paddingTop: 6 },
      }}
    >
      {items.map((it) => (
        <Tabs.Screen
          key={it.name}
          name={it.name}
          options={{
            title: it.title,
            tabBarIcon: () => null,
            tabBarIconStyle: { display: 'none' },
            tabBarLabel: ({ focused }: { focused: boolean }) => (
              <View style={styles.tab}>
                <Icon name={it.icon} size={26} color={focused ? lightColors.accent : lightColors.textSecondary} />
                <Text style={[styles.label, focused && styles.labelActive]}>{it.title}</Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', gap: 2 },
  label: { ...typography.caption, color: lightColors.textSecondary },
  labelActive: { color: lightColors.accent },
  denied: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], justifyContent: 'center', gap: space[3] },
  deniedTitle: { ...typography.h1, color: lightColors.text },
  deniedText: { ...typography.body, color: lightColors.textSecondary },
});
