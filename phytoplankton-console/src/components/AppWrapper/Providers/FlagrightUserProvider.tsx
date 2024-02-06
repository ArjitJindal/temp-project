import React from 'react';
import { Button } from 'antd';
import jwtDecode from 'jwt-decode';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import ErrorPage from '@/components/ErrorPage';
import { Context, FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { USER_INFO } from '@/utils/queries/keys';
import { Permission } from '@/apis';
import { IHeap } from '@/@types/heap';
import { PageLoading } from '@/components/PageLoading';

const branding = getBranding();

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { getAccessTokenSilently } = useAuth0();

  const { data: userRes } = useQuery<FlagrightAuth0User | 'ORPHAN'>(
    USER_INFO('access_token'),
    async () => {
      const accessToken = await getAccessTokenSilently();
      if (accessToken == null) {
        throw new Error(`Access token can not be null at this point`);
      }
      const user = jwtDecode<Record<string, any>>(accessToken);

      const name: string | null = user[`${NAMESPACE}/name`] ?? '-';
      const picture: string | null = user[`${NAMESPACE}/picture`] ?? null;
      const tenantConsoleApiUrl: string | null = user[`${NAMESPACE}/tenantConsoleApiUrl`];
      const region: string | null = user[`${NAMESPACE}/region`];
      const tenantId: string | null = user[`${NAMESPACE}/tenantId`];
      const tenantName: string | null = user[`${NAMESPACE}/tenantName`];
      const verifiedEmail: string | null = user[`${NAMESPACE}/verifiedEmail`];
      const demoMode: boolean | null = user[`${NAMESPACE}/demoMode`];
      const role = user[`${NAMESPACE}/role`] ?? 'user';
      const userId = user[`${NAMESPACE}/userId`] ?? null;
      const permissionsList: Permission[] = user[`permissions`] ?? [];
      const permissions = new Map<Permission, boolean>();
      const allowTenantDeletion = user[`${NAMESPACE}/allowTenantDeletion`] ?? false;

      permissionsList.map((p) => permissions.set(p, true));

      if (tenantConsoleApiUrl == null || tenantId == null || tenantName == null) {
        return 'ORPHAN';
      }

      const appUser: FlagrightAuth0User = {
        name: name,
        picture: picture ?? null,
        role: role,
        userId: userId,
        tenantId: tenantId,
        tenantName: tenantName,
        tenantConsoleApiUrl: tenantConsoleApiUrl,
        region,
        verifiedEmail: verifiedEmail ?? null,
        demoMode: demoMode === true,
        permissions,
        allowTenantDeletion,
      };

      return appUser;
    },
  );

  return (
    <AsyncResourceRenderer resource={userRes} renderLoading={() => <PageLoading />}>
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

        if (user.name) {
          ((window as any).heap as IHeap)?.identify(user.name);
        }
        return <Context.Provider value={{ user: user }}>{props.children}</Context.Provider>;
      }}
    </AsyncResourceRenderer>
  );
}
