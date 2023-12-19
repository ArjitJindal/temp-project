import React from 'react';
import { Auth0Provider, withAuthenticationRequired } from '@auth0/auth0-react';
import { getBranding } from '@/utils/branding';
import { PageLoading } from '@/components/PageLoading';

const AuthenticationRequiredWrapper = withAuthenticationRequired(
  (({ children: innerChildren }) => innerChildren) as React.FC,
  {
    onRedirecting: () => {
      return <PageLoading />;
    },
  },
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
