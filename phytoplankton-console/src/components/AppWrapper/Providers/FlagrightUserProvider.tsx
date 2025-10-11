import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ErrorPage from '@/components/ErrorPage';
import { Context } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { getBranding } from '@/utils/branding';
import { PageLoading } from '@/components/PageLoading';
import { BaseButton } from '@/components/library/Button';
import { useFlagrightUser } from '@/hooks/api';

const branding = getBranding();

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { logout } = useAuth0();
  const { data: userRes } = useFlagrightUser();

  return (
    <AsyncResourceRenderer resource={userRes} renderLoading={() => <PageLoading />}>
      {(user) => {
        if (user === 'ORPHAN') {
          // todo: make proper logout button
          return (
            <ErrorPage title={'User Not Provisioned'}>
              <p>{branding.notProvisionedWarning}</p>
              <BaseButton onClick={() => logout({ returnTo: window.location.origin })}>
                Log out
              </BaseButton>
            </ErrorPage>
          );
        }

        return <Context.Provider value={{ user: user }}>{props.children}</Context.Provider>;
      }}
    </AsyncResourceRenderer>
  );
}
