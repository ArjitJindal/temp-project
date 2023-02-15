import React from 'react';
import { Button } from 'antd';
import jwtDecode from 'jwt-decode';
import { Link } from 'react-router-dom';
import ErrorPage from '@/components/ErrorPage';
import { Context, FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { useAuth } from '@/components/AppWrapper/Providers/AuthProvider';
import { getBranding } from '@/utils/branding';
import { USER_INFO } from '@/utils/queries/keys';
import { Permission } from '@/apis';

const branding = getBranding();

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { accessToken } = useAuth();

  const { data: userRes } = useQuery<FlagrightAuth0User | 'ORPHAN'>(
    USER_INFO(accessToken),
    async () => {
      if (accessToken == null) {
        throw new Error(`Access token can not be null at this point`);
      }
      const user = jwtDecode<Record<string, any>>(accessToken);

      const name: string | null = user[`${NAMESPACE}/name`] ?? '-';
      const picture: string | null = user[`${NAMESPACE}/picture`] ?? null;
      const tenantConsoleApiUrl: string | null = user[`${NAMESPACE}/tenantConsoleApiUrl`];
      const tenantId: string | null = user[`${NAMESPACE}/tenantId`];
      const tenantName: string | null = user[`${NAMESPACE}/tenantName`];
      const verifiedEmail: string | null = user[`${NAMESPACE}/verifiedEmail`];
      const demoMode: boolean | null = user[`${NAMESPACE}/demoMode`];
      const role = user[`${NAMESPACE}/role`] ?? 'user';
      const userId = user[`${NAMESPACE}/userId`] ?? null;
      const permissionsList: Permission[] = user[`permissions`] ?? [];
      const permissions = new Map<Permission, boolean>();
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
        verifiedEmail: verifiedEmail ?? null,
        demoMode: demoMode === true,
        permissions,
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
