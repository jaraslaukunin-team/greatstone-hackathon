import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef } from 'react';
import { futuraFonts } from '../src/theme/fonts';
import { ApiClientContext } from '../src/api/hooks';
import { createApiClient } from '../src/api/client';
import { API_URL } from '../src/config';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { parseInviteUrl } from '../src/album/parseInvite';
import { networkFailureRef } from '../src/dev/networkFailure';

export { ErrorBoundary } from 'expo-router';

const queryClient = new QueryClient();

void SplashScreen.preventAutoHideAsync();

function ApiBridge({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getToken: () => tokenRef.current,
        shouldFailNetwork: () => networkFailureRef.current,
      }),
    [],
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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(futuraFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ApiBridge>
          <DeepLinkBridge>
            <Stack screenOptions={{ headerShown: false }}>
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
              <Stack.Screen name="invite" />
              <Stack.Screen name="ai" />
              <Stack.Screen name="operator" />
              <Stack.Screen name="profile" />
            </Stack>
          </DeepLinkBridge>
        </ApiBridge>
      </AuthProvider>
    </QueryClientProvider>
  );
}
