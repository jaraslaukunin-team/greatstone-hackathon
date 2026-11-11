import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { lightColors } from '../../src/theme/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? lightColors.accent : lightColors.textMuted, fontSize: 11 }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lightColors.accent,
        tabBarInactiveTintColor: lightColors.textMuted,
        tabBarStyle: {
          backgroundColor: lightColors.surface,
          borderTopColor: lightColors.border,
          height: 64,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: ({ focused }) => <TabLabel label="Главная" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="designs"
        options={{
          title: 'Мои',
          tabBarLabel: ({ focused }) => <TabLabel label="Мои" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Корзина',
          tabBarLabel: ({ focused }) => <TabLabel label="Корзина" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          tabBarLabel: ({ focused }) => <TabLabel label="Заказы" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: ({ focused }) => <TabLabel label="Профиль" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
