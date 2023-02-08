import React from 'react';
import { Button } from 'antd';
import { Link } from 'react-router-dom';
import ErrorPage from '@/components/ErrorPage';
import { Context, FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { accessToken, getUserInfo } = useAuth();

  const { data: userRes } = useQuery<FlagrightAuth0User | 'ORPHAN'>(
    ['USER_INFO', accessToken], // todo: make proper key
    async () => {
      const user = await getUserInfo();
      const tenantConsoleApiUrl: string | null = user[`${NAMESPACE}/tenantConsoleApiUrl`];
      const tenantId: string | null = user[`${NAMESPACE}/tenantId`];
      const tenantName: string | null = user[`${NAMESPACE}/tenantName`];
      const verifiedEmail: string | null = user[`${NAMESPACE}/verifiedEmail`];
      const demoMode: boolean | null = user[`${NAMESPACE}/demoMode`];

      if (tenantConsoleApiUrl == null || tenantId == null || tenantName == null) {
        return 'ORPHAN';
      }

      const name = user.name ?? '-';

      const appUser: FlagrightAuth0User = {
        name: name,
        picture: user.picture ?? null,
        role: user[`${NAMESPACE}/role`] ?? 'user',
        userId: user[`${NAMESPACE}/userId`] ?? null,
        tenantId: tenantId,
        tenantName: tenantName,
        tenantConsoleApiUrl: tenantConsoleApiUrl,
        verifiedEmail: verifiedEmail ?? null,
        demoMode: demoMode === true,
      };

      return appUser;
    },
  );

  return (
    <AsyncResourceRenderer resource={userRes}>
      {(user) => {
        if (user === 'ORPHAN') {
          // todo: make proper logout button
          return (
            <ErrorPage title={'User Not Provisioned'}>
              <p>{branding.notProvisionedWarning}</p>
              <Link to={'/logout'}>
                <Button>Log out</Button>
              </Link>
            </ErrorPage>
          );
        }

        return <Context.Provider value={{ user: user }}>{props.children}</Context.Provider>;
      }}
    </AsyncResourceRenderer>
  );
}
