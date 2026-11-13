import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { homeFor } from '../src/auth/roleMode';
import { useRoleMode } from '../src/auth/roleStore';
import { useSettingsStore } from '../src/settings/settingsStore';
import { ListSkeleton } from '../src/ui/Skeleton';

export default function Index() {
  const { token, user, ready } = useAuth();
  const mode = useRoleMode((s) => s.mode);
  const onboardingSeen = useSettingsStore((s) => s.onboardingSeen);

  if (!ready) return <ListSkeleton count={2} />;

  if (token) {
    return <Redirect href={homeFor(mode, user ?? { role: 'customer' })} />;
  }

  if (!onboardingSeen) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
