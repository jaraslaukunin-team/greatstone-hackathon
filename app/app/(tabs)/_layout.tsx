import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../src/ui/Icon';
import { lightColors, typography } from '../../src/theme/theme';

function TabLabel({ label, icon, focused }: { label: string; icon: IconName; focused: boolean }) {
  return (
    <View style={styles.tab}>
      <Icon name={icon} size={26} color={focused ? lightColors.accent : lightColors.textSecondary} />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const items = [
  { name: 'index', title: 'Главная', icon: 'home' },
  { name: 'designs', title: 'Мои', icon: 'folder' },
  { name: 'assistant', title: 'AI', icon: 'star' },
  { name: 'cart', title: 'Корзина', icon: 'cart' },
  { name: 'orders', title: 'Заказы', icon: 'doc' },
  { name: 'profile', title: 'Профиль', icon: 'user' },
] as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // иконка рисуется внутри tabBarLabel, стандартный слот скрываем
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarActiveTintColor: lightColors.text,
        tabBarInactiveTintColor: lightColors.textSecondary,
        tabBarStyle: {
          backgroundColor: lightColors.surface,
          borderTopColor: lightColors.border,
          height: 72,
          paddingTop: 6,
          paddingBottom: 8,
        },
      }}
    >
      {items.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarLabel: ({ focused }) => <TabLabel label={item.title} icon={item.icon} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 64, minHeight: 44 },
  label: { ...typography.label, color: lightColors.textSecondary },
  labelActive: { color: lightColors.text },
});
