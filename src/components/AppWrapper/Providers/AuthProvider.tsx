import React from 'react';
import { Auth0Provider, withAuthenticationRequired } from '@auth0/auth0-react';
import { PageLoading } from '@ant-design/pro-layout';
// import { history } from '@@/core/history';

const AuthenticationRequiredWrapper = withAuthenticationRequired(
  (({ children: innerChildren }) => innerChildren) as React.FC,
  { onRedirecting: () => <PageLoading /> },
);

const onRedirectCallback = (_appState: any) => {
  // navigate(appState && appState.returnTo ? appState.returnTo : window.location.pathname)
};

const providerConfig = {
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
  scope: 'openid profile email',
  cacheLocation: IS_SENTRY_INSTANCE ? ('localstorage' as const) : ('memory' as const),
  audience: AUTH0_AUDIENCE ?? undefined,
  redirectUri: window.location.origin,
  onRedirectCallback,
};

const AuthProvider: React.FC = ({ children }) => {
  return (
    <Auth0Provider {...providerConfig}>
      <AuthenticationRequiredWrapper>{children}</AuthenticationRequiredWrapper>
    </Auth0Provider>
  );
};

export default AuthProvider;
