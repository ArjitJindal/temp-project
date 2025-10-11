import jwtDecode from 'jwt-decode';
import { useAuth0 } from '@auth0/auth0-react';
import { useQuery } from '@/utils/queries/hooks';
import { USER_INFO } from '@/utils/queries/keys';
import { FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';
import { Permission } from '@/apis';

export function useFlagrightUser() {
  const { getAccessTokenSilently } = useAuth0();
  return useQuery<FlagrightAuth0User | 'ORPHAN'>(USER_INFO('access_token'), async () => {
    const accessToken = await getAccessTokenSilently();
    if (accessToken == null) {
      throw new Error('Access token can not be null at this point');
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
    const orgName: string | null = user[`${NAMESPACE}/orgName`];
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
      orgName: orgName ?? null,
    };

    return appUser;
  });
}
