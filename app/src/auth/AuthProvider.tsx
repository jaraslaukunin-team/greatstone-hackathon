import type { UserDTO } from '@picpac/shared';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient } from '../api/client';
import { API_URL } from '../config';
import { createTokenStore } from './tokenStore';

type AuthContextValue = {
  user: UserDTO | null;
  token: string | null;
  ready: boolean;
  loginAsGuest(): Promise<void>;
  requestCode(contact: string): Promise<void>;
  verifyCode(contact: string, code: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const tokenStore = createTokenStore({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await tokenStore.get();
      if (!saved) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const client = createApiClient({
          baseUrl: API_URL,
          getToken: () => saved,
        });
        const me = await client.get<UserDTO>('/me');
        if (!cancelled) {
          setToken(saved);
          setUser(me);
        }
      } catch {
        await tokenStore.clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback(async (nextToken: string, nextUser: UserDTO) => {
    await tokenStore.set(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const loginAsGuest = useCallback(async () => {
    const client = createApiClient({ baseUrl: API_URL, getToken: () => null });
    const res = await client.post<{ token: string; user: UserDTO }>('/auth/guest');
    await applySession(res.token, res.user);
  }, [applySession]);

  const requestCode = useCallback(async (contact: string) => {
    const client = createApiClient({ baseUrl: API_URL, getToken: () => null });
    await client.post('/auth/request-code', { contact });
  }, []);

  const verifyCode = useCallback(
    async (contact: string, code: string) => {
      const client = createApiClient({ baseUrl: API_URL, getToken: () => null });
      const res = await client.post<{ token: string; user: UserDTO }>('/auth/verify-code', {
        contact,
        code,
      });
      await applySession(res.token, res.user);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, ready, loginAsGuest, requestCode, verifyCode, logout }),
    [user, token, ready, loginAsGuest, requestCode, verifyCode, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider отсутствует');
  return ctx;
}
