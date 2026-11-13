import { installRuntimeTranslate, tr } from '../src/i18n/runtimeTranslate';
import { LaunchLogo } from '../src/ui/LaunchLogo';
import { RouteTransition } from '../src/ui/RouteTransition';
import { useSettingsStore } from '../src/settings/settingsStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { ErrorBoundary as RouterErrorBoundary, Stack, router, type ErrorBoundaryProps } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { futuraFonts } from '../src/theme/fonts';
import { ApiClientContext } from '../src/api/hooks';
import { createApiClient } from '../src/api/client';
import { API_URL } from '../src/config';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { sessionTokenRef } from '../src/auth/sessionToken';
import { parseInviteUrl } from '../src/album/parseInvite';
import { networkFailureRef, setNetworkFailure } from '../src/dev/networkFailure';
import { WebPhoneShell } from '../src/ui/WebPhoneShell';

import { StateBanner } from '../src/ui/StateBanner';
import { lightColors, space } from '../src/theme/theme';

export function ErrorBoundary(props: ErrorBoundaryProps) {
  if (Platform.OS !== 'web' || !/Loading (?:module|chunk)|ChunkLoadError|failed to fetch dynamically imported module/i.test(props.error.message)) {
    return <RouterErrorBoundary {...props} />;
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space[4], backgroundColor: lightColors.bg }}>
      <StateBanner
        title="Не удалось открыть экран"
        message="Обновите страницу, чтобы заново загрузить приложение."
        tone="warning"
        actionLabel="Обновить страницу"
        onAction={() => window.location.reload()}
      />
    </View>
  );
}

const queryClient = new QueryClient();

void SplashScreen.preventAutoHideAsync();

function ApiBridge({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getToken: () => sessionTokenRef.current ?? token,
        shouldFailNetwork: () => networkFailureRef.current,
      }),
    [token],
  );

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

function DeepLinkBridge({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function handleUrl(url: string | null) {
      if (!url) return;
      const token = parseInviteUrl(url);
      if (token) {
        router.push({ pathname: '/album/invite', params: { token } });
      }
    }

    void Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}

// Перевод интерфейса на белорусский при отрисовке: ставится до первого рендера.
installRuntimeTranslate();

export default function RootLayout() {
  // Смена языка перемонтирует навигатор, чтобы все экраны перерисовались с новыми строками.
  const lang = useSettingsStore((s) => s.lang);
  const failNetwork = useSettingsStore((s) => s.failNetwork);
  const [fontsLoaded, fontError] = useFonts(futuraFonts);
  const [showLaunch, setShowLaunch] = useState(true);
  const finishLaunch = useCallback(() => setShowLaunch(false), []);

  // Демо-переключатель «Имитация сбоя сети»: сетевая ошибка на каждом запросе к API.
  useEffect(() => {
    setNetworkFailure(failNetwork);
  }, [failNetwork]);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>PicPac</title>
        <link rel="icon" type="image/png" href="/favicon.png?v=picpac" />
        <link rel="apple-touch-icon" href="/favicon.png?v=picpac" />
      </Head>
      <AuthProvider>
        <ApiBridge>
          <DeepLinkBridge>
            <WebPhoneShell>
              <RouteTransition>
              <Stack key={lang} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(staff)" />
                <Stack.Screen name="catalog" />
                <Stack.Screen name="project" />
                <Stack.Screen name="checkout" />
                <Stack.Screen name="orders" />
                <Stack.Screen name="print" />
                <Stack.Screen name="album" />
                <Stack.Screen name="invite/[token]" />
                <Stack.Screen name="photo-editor" options={{ presentation: 'modal', title: tr('Редактор фото'), headerShown: false }} />
                <Stack.Screen name="ai" />
                <Stack.Screen name="operator" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="showcase" />
                <Stack.Screen
                  name="stories"
                  options={{ presentation: 'modal', headerShown: false, animation: 'fade' }}
                />
              </Stack>
              </RouteTransition>
            </WebPhoneShell>
          </DeepLinkBridge>
        </ApiBridge>
      </AuthProvider>
      {showLaunch ? <LaunchLogo onFinish={finishLaunch} /> : null}
    </QueryClientProvider>
  );
}
