import React from 'react';
import { Auth0Provider, withAuthenticationRequired } from '@auth0/auth0-react';
import { PageLoading } from '@ant-design/pro-layout';
import { getBranding } from '@/utils/branding';

const AuthenticationRequiredWrapper = withAuthenticationRequired(
  (({ children: innerChildren }) => innerChildren) as React.FC,
  { onRedirecting: () => <PageLoading /> },
);

const branding = getBranding();
export const providerConfig = {
  domain: branding.auth0Domain,
  clientId: branding.auth0ClientId,
  scope: 'openid profile email',
  cacheLocation: 'localstorage',
  audience: AUTH0_AUDIENCE ?? undefined,
  redirectUri: `${window.location.origin}${branding.redirectPath || ''}`,
} as const;

const AuthProvider: React.FC = ({ children }) => {
  return (
    <Auth0Provider {...providerConfig}>
      <AuthenticationRequiredWrapper>{children}</AuthenticationRequiredWrapper>
    </Auth0Provider>
  );
};

export default AuthProvider;
