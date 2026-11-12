import { Tabs, router, type Href } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takePendingInvite } from '../../src/album/pendingInvite';
import { Icon, type IconName } from '../../src/ui/Icon';
import { AppHeader } from '../../src/ui/AppHeader';
import { lightColors, typography } from '../../src/theme/theme';
import { useT } from '../../src/i18n/useT';

/** Вкладки в нижнем баре (без профиля — он в шапке). */
const barTabNames = ['index', 'designs', 'editor', 'cart', 'orders'] as const;
type TabName = (typeof barTabNames)[number] | 'profile';

const tabIcons: Record<TabName, IconName> = {
  index: 'home',
  designs: 'folder',
  editor: 'pencil',
  cart: 'cart',
  orders: 'doc',
  profile: 'user',
};

const tabHrefs: Record<TabName, Href> = {
  index: '/(tabs)',
  designs: '/(tabs)/designs',
  editor: '/(tabs)/editor',
  cart: '/(tabs)/cart',
  orders: '/(tabs)/orders',
  profile: '/(tabs)/profile',
};

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function TabBar({ state, descriptors }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'web' ? 12 : 8);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      {state.routes.map((route, index) => {
        if (route.name === 'profile') return null;

        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : typeof options.title === 'string'
              ? options.title
              : route.name;
        const name = route.name as TabName;
        const icon = tabIcons[name] ?? 'home';
        const color = focused ? lightColors.accent : lightColors.textSecondary;

        const onPress = () => {
          if (focused) return;
          // Не navigation.emit — в кастомном tabBar у Expo Router navigation иногда undefined.
          router.navigate(tabHrefs[name] ?? `/(tabs)/${route.name}`);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            style={styles.tab}
          >
            <Icon name={icon} size={24} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const t = useT();

  const tabTitles: Record<TabName, string> = {
    index: t.tabs.home,
    designs: t.tabs.designs,
    editor: t.tabs.editor,
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
    <View style={styles.root}>
      <AppHeader />
      <View style={styles.tabs}>
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false, animation: 'fade' }}
        >
          {barTabNames.map((name) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: tabTitles[name],
                tabBarLabel: tabTitles[name],
              }}
            />
          ))}
          <Tabs.Screen
            name="profile"
            options={{
              title: tabTitles.profile,
              tabBarLabel: tabTitles.profile,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },
  tabs: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: lightColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lightColors.border,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 2,
  },
  label: {
    ...typography.label,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
