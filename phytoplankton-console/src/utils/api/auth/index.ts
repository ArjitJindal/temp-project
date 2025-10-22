import { useAuth0 } from '@auth0/auth0-react';
import jwtDecode from 'jwt-decode';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Updater } from '@tanstack/react-table';
import { keyBy } from 'lodash';
import { useQuery } from '@/utils/queries/hooks';
import {
  ACCOUNT_LIST,
  PERMISSIONS_STATEMENTS,
  ROLES_LIST,
  SETTINGS,
  TENANT,
  USER_INFO,
} from '@/utils/queries/keys';
import {
  FlagrightAuth0User,
  isAtLeast,
  NAMESPACE,
  parseUserRole,
  SYSTEM_USERS,
  useAuth0User,
  UserRole,
} from '@/utils/user-utils';
import { Account, ApiException, Permission } from '@/apis';
import { useApi } from '@/api';
import { getOr, isLoading } from '@/utils/asyncResource';

export const useFlagrightUser = () => {
  const { getAccessTokenSilently } = useAuth0();
  return useQuery<FlagrightAuth0User | 'ORPHAN'>(USER_INFO('access_token'), async () => {
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
      name,
      picture: picture ?? null,
      role,
      userId,
      tenantId,
      tenantName,
      tenantConsoleApiUrl,
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
};

export const useRoles = () => {
  const api = useApi();
  const rolesQueryResult = useQuery(ROLES_LIST(), async () => {
    const roles = await api.getRoles();
    return {
      items: roles,
      total: roles.length,
    };
  });
  return {
    roles: rolesQueryResult,
    rolesList: getOr(rolesQueryResult.data, { items: [], total: 0 }).items,
    isLoading: isLoading(rolesQueryResult.data),
    refetch: rolesQueryResult.refetch,
  };
};

export const useAccounts = () => {
  const api = useApi();
  return useQuery(
    ACCOUNT_LIST(),
    async () => {
      try {
        return await api.getAccounts();
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    {
      staleTime: Infinity,
    },
  );
};

export const useUsers = ({
  includeRootUsers = false,
  includeBlockedUsers = false,
  includeSystemUsers = true,
}: {
  includeRootUsers?: boolean;
  includeBlockedUsers?: boolean;
  includeSystemUsers?: boolean;
} = {}) => {
  const user = useAuth0User();
  const accounts = useAccounts();
  const isSuperAdmin = isAtLeast(user, UserRole.ROOT);
  const users = getOr(accounts.data, []);
  let tempUsers = [...users, ...(includeSystemUsers ? SYSTEM_USERS : [])];

  if (!includeRootUsers && !isSuperAdmin) {
    tempUsers = tempUsers.filter((user) => {
      const role = parseUserRole(user.role);
      return role !== UserRole.ROOT && role !== UserRole.WHITELABEL_ROOT;
    });
  }

  if (!includeBlockedUsers) {
    tempUsers = tempUsers.filter((user) => !user.blocked);
  }

  return { users: keyBy(tempUsers, 'id'), isLoading: isLoading(accounts.data) };
};

export const useTenantInfo = () => {
  const api = useApi();
  const { tenantId } = useAuth0User();
  const tenant = useQuery(TENANT(tenantId), async () => {
    try {
      return await api.getTenant();
    } catch (e) {
      console.error(e);
      return undefined;
    }
  });
  return getOr(tenant.data, null);
};

export const usePermissions = () => {
  const api = useApi();
  return useQuery(PERMISSIONS_STATEMENTS(), async () => {
    return await api.getRolesByNameStatements();
  });
};

export const useSettingsData = () => {
  const api = useApi();
  const { logout } = useAuth0();
  return useQuery(SETTINGS(), async () => {
    try {
      return await api.getTenantsSettings();
    } catch (e) {
      if ((e as ApiException<unknown>).httpMessage === 'Unauthorized') {
        logout({
          returnTo: window.location.origin,
        });
      }
      throw e;
    }
  });
};

export const useAuthUpdates = () => {
  const queryClient = useQueryClient();

  const updateAccounts = useCallback(
    (updater: Updater<Account[] | undefined>) => {
      queryClient.setQueryData(ACCOUNT_LIST(), updater);
    },
    [queryClient],
  );

  return { updateAccounts };
};
