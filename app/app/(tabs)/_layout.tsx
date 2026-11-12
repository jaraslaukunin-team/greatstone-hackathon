import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { takePendingInvite } from '../../src/album/pendingInvite';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../../src/ui/Icon';
import { lightColors, typography } from '../../src/theme/theme';
import { useT } from '../../src/i18n/useT';

function TabLabel({ label, icon, focused }: { label: string; icon: IconName; focused: boolean }) {
  return (
    <View style={styles.tab}>
      <Icon name={icon} size={26} color={focused ? lightColors.accent : lightColors.textSecondary} />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const tabNames = ['index', 'designs', 'assistant', 'cart', 'orders', 'profile'] as const;
const tabIcons: Record<typeof tabNames[number], IconName> = {
  index: 'home',
  designs: 'folder',
  assistant: 'star',
  cart: 'cart',
  orders: 'doc',
  profile: 'user',
};

export default function TabsLayout() {
  const t = useT();

  const tabTitles: Record<typeof tabNames[number], string> = {
    index: t.tabs.home,
    designs: t.tabs.designs,
    assistant: t.tabs.assistant,
    cart: t.tabs.cart,
    orders: t.tabs.orders,
    profile: t.tabs.profile,
  };

  // Accept pending album invite right after login.
  useEffect(() => {
    void takePendingInvite().then((token) => {
      if (token) router.replace({ pathname: '/album/invite', params: { token } });
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
      {tabNames.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabTitles[name],
            tabBarLabel: ({ focused }) => (
              <TabLabel label={tabTitles[name]} icon={tabIcons[name]} focused={focused} />
            ),
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
