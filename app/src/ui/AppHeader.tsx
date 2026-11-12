import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useT } from '../i18n/useT';
import { lightColors, space } from '../theme/theme';
import { HeaderEdge } from './HeaderEdge';
import { Wordmark } from './Wordmark';

const LOGO_H = 38;
const PROFILE_SIZE = 48;
const GLYPH = 22;

/** Симметричная иконка профиля (центр viewBox 12,12). */
function ProfileGlyph({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </Svg>
  );
}

/** Шапка без красной полосы: лого слева, профиль в кружке справа. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, space[2]) }]}>
      <View style={styles.row}>
        <Wordmark color={lightColors.accent} height={LOGO_H} />
        <Pressable
          onPress={() => router.navigate('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel={t.tabs.profile}
          hitSlop={8}
          style={styles.profileHit}
        >
          <View style={styles.profileCircle}>
            <ProfileGlyph color={lightColors.text} />
          </View>
        </Pressable>
      </View>
      <HeaderEdge />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: lightColors.bg,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    zIndex: 10,
    overflow: 'visible',
  },
  row: {
    minHeight: PROFILE_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileHit: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
  },
  profileCircle: {
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: PROFILE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: lightColors.borderStrong,
    backgroundColor: lightColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
