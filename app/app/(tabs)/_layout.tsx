import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takePendingInvite } from '../../src/album/pendingInvite';
import { Icon, type IconName } from '../../src/ui/Icon';
import { lightColors, typography } from '../../src/theme/theme';
import { useT } from '../../src/i18n/useT';

const tabNames = ['index', 'designs', 'assistant', 'cart', 'orders', 'profile'] as const;
const tabIcons: Record<(typeof tabNames)[number], IconName> = {
  index: 'home',
  designs: 'folder',
  assistant: 'star',
  cart: 'cart',
  orders: 'doc',
  profile: 'user',
};

export default function TabsLayout() {
  const t = useT();
  const insets = useSafeAreaInsets();
  // На вебе safe-area часто 0 — запас, чтобы подписи не обрезались краем окна.
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 8);
  const tabBarHeight = 56 + bottomPad;

  const tabTitles: Record<(typeof tabNames)[number], string> = {
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
        tabBarActiveTintColor: lightColors.accent,
        tabBarInactiveTintColor: lightColors.textSecondary,
        tabBarStyle: {
          backgroundColor: lightColors.surface,
          borderTopColor: lightColors.border,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarHideOnKeyboard: true,
      }}
    >
      {tabNames.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: tabTitles[name],
            tabBarLabel: tabTitles[name],
            tabBarIcon: ({ focused, color }) => (
              <Icon name={tabIcons[name]} size={24} color={focused ? lightColors.accent : color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  item: { justifyContent: 'center' },
  label: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 14,
  },
});
