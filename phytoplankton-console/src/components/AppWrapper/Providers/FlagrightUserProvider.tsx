import React from 'react';
import jwtDecode from 'jwt-decode';
import { useAuth0 } from '@auth0/auth0-react';
import ErrorPage from '@/components/ErrorPage';
import { Context, FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { getBranding } from '@/utils/branding';
import { USER_INFO } from '@/utils/queries/keys';
import { Permission } from '@/apis';
import { PageLoading } from '@/components/PageLoading';
import { BaseButton } from '@/components/library/Button';

const branding = getBranding();

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { getAccessTokenSilently, logout } = useAuth0();

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
      const allowedRegions = user[`${NAMESPACE}/allowedRegions`] ?? [];
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
        allowedRegions,
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
