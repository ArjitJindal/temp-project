import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import { Auth0UserProfile } from 'auth0-js';
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
  getUserInfo: () => Promise<Auth0UserProfile>;
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

  const handleGetUserInfo = useCallback((): Promise<Auth0UserProfile> => {
    return new Promise((resolve, reject) => {
      if (!isInitialized || accessToken == null) {
        reject(Error(`You should be authorised to get user info`));
      } else {
        lock.getUserInfo(accessToken, (error, profile) => {
          if (error) {
            reject(error);
          } else {
            resolve(profile);
          }
        });
      }
    });
  }, [accessToken, isInitialized]);

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

  const contextValue = useMemo(
    () => ({
      accessToken,
      login: handleLogin,
      logout: handleLogout,
      getUserInfo: handleGetUserInfo,
    }),
    [accessToken, handleLogin, handleLogout, handleGetUserInfo],
  );

  if (!isInitialized) {
    return <Spin />;
  }

  return <Context.Provider value={contextValue}>{props.children}</Context.Provider>;
}
