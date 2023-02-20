import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import { Spin } from 'antd';
import Auth0Lock from './auth0Lock';
import COLORS from '@/components/ui/colors';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

const lock: typeof Auth0Lock = new Auth0Lock(
  branding.auth0ClientId ?? AUTH0_CLIENT_ID,
  AUTH0_DOMAIN,
  {
    theme: {
      primaryColor: COLORS.brandBlue.base,
    },
    auth: {
      audience: AUTH0_AUDIENCE,
      redirect: false,
      redirectUrl: window.location.origin,
      responseType: 'token',
      sso: false,
      params: {
        scope: 'openid profile email',
      },
    },
  },
);

interface TokenInfo {
  token: string;
  expiresIn: number;
}

interface AuthContextValue {
  accessToken: string | null;
  login: () => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

const Context = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Context is not initialized property`);
  }
  return context;
}

const key = 'accessToken';

export default function AuthProvider(props: { children: React.ReactNode }) {
  const [storedValue, setStoredValue] = useLocalStorageState<TokenInfo | null>(key, null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitialized, setInitialized] = useState<boolean>(false);

  const handleLogin = useCallback(() => {
    lock.show();
  }, []);

  useEffect(() => {
    const handleAuthenticated = function (authResult: AuthResult) {
      const newAccessToken = authResult.accessToken;
      setAccessToken(newAccessToken);
      setStoredValue({
        token: newAccessToken,
        expiresIn: Date.now() + authResult.expiresIn * 1000,
      });
      lock.hide();
    };
    lock.on('authenticated', handleAuthenticated);
    return () => {
      lock.off('authenticated', handleAuthenticated);
    };
  }, [setStoredValue]);

  const handleLogout = useCallback(() => {
    setAccessToken(null);
    setStoredValue(null);
  }, [setStoredValue]);

  const handleRefreshAccessToken = useCallback((): Promise<void> => {
    if (accessToken == null) {
      throw new Error(`Access token is null`);
    }
    return new Promise((resolve, reject) => {
      lock.checkSession(
        {
          access_token: accessToken,
        },
        (error, authResult) => {
          if (error) {
            setStoredValue(null);
            setAccessToken(null);
            reject(error);
          } else if (authResult != null) {
            const newAccessToken = authResult.accessToken;
            setAccessToken(newAccessToken);
            setStoredValue({
              token: newAccessToken,
              expiresIn: Date.now() + authResult.expiresIn * 1000,
            });
            resolve();
          }
        },
      );
    });
  }, [accessToken, setStoredValue, setAccessToken]);

  useEffect(() => {
    const now = Date.now();
    if (storedValue == null) {
      setInitialized(true);
    } else {
      if (storedValue.expiresIn > now) {
        setAccessToken(storedValue.token);
        setInitialized(true);
      } else {
        lock.checkSession(
          {
            access_token: storedValue.token,
          },
          (error, authResult) => {
            if (error) {
              console.error('Auth token refresh error', error);
              setStoredValue(null);
              setAccessToken(null);
            } else if (authResult != null) {
              const newAccessToken = authResult.accessToken;
              setAccessToken(newAccessToken);
              setStoredValue({
                token: newAccessToken,
                expiresIn: Date.now() + authResult.expiresIn * 1000,
              });
            }
            setInitialized(true);
          },
        );
      }
    }
  }, [storedValue, setStoredValue]);

  const contextValue: AuthContextValue = useMemo(
    () => ({
      accessToken,
      login: handleLogin,
      logout: handleLogout,
      refreshAccessToken: handleRefreshAccessToken,
    }),
    [accessToken, handleLogin, handleLogout, handleRefreshAccessToken],
  );

  if (!isInitialized) {
    return <Spin />;
  }

  return <Context.Provider value={contextValue}>{props.children}</Context.Provider>;
}
