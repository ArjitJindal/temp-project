import React, { useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keyBy } from 'lodash';
import { useQuery } from './queries/hooks';
import { ACCOUNT_LIST, ROLES_LIST } from './queries/keys';
import { getOr, isLoading } from './asyncResource';
import { QueryResult } from './queries/types';
import { useApi } from '@/api';
import { Account, AccountRole, Permission } from '@/apis';

// todo: rename file and utils to use "account" instead of "user" in names
export enum UserRole {
  ROOT = 'root',
  WHITELABEL_ROOT = 'whitelabel-root',
  ADMIN = 'admin',
  USER = 'user',
}

export const ROLES_ORDER = ['root', 'whitelabel-root', 'admin', 'user'];

export const FLAGRIGHT_SYSTEM_USER = 'Flagright System';

export const API_USER = 'API';

export interface FlagrightAuth0User {
  name: string | null;
  picture: string | null;
  role: string | null;
  userId: string;
  verifiedEmail: string | null;
  tenantId: string;
  tenantName: string;
  region: string | null;
  tenantConsoleApiUrl: string;
  demoMode: boolean;
  permissions?: Map<Permission, boolean>;
  allowTenantDeletion?: boolean;
  allowedRegions?: string[];
}

const SYSTEM_USERS: Account[] = [
  {
    name: FLAGRIGHT_SYSTEM_USER,
    email: FLAGRIGHT_SYSTEM_USER,
    picture: undefined,
    role: UserRole.USER,
    id: FLAGRIGHT_SYSTEM_USER,
    isEscalationContact: false,
    emailVerified: true,
    blocked: false,
  },
  {
    name: API_USER,
    email: API_USER,
    picture: undefined,
    role: UserRole.USER,
    id: API_USER,
    isEscalationContact: false,
    emailVerified: true,
    blocked: false,
  },
];

export const NAMESPACE = 'https://flagright.com';

export function clearAuth0LocalStorage() {
  const auth0Key = Object.keys(window.localStorage).find((key) => key.includes('@auth0'));
  if (auth0Key) {
    window.localStorage.removeItem(auth0Key);
  }
}

export function useAuth0User(): FlagrightAuth0User {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Account context is not initialized properly`);
  }
  return context.user;
}

export function useCurrentUser(): Account | null {
  const [users] = useUsers();
  const user = useAuth0User();
  return users[user.userId];
}

export function useAccountRole(): UserRole {
  const user = useAuth0User();
  return parseUserRole(user?.role ?? null);
}

export function usePermissions(): Map<Permission, boolean> {
  const user = useAuth0User();
  return user.permissions || new Map<Permission, boolean>();
}
export function useHasPermissions(requiredPermissions: Permission[]): boolean {
  const permissions = usePermissions();
  const missingPermissions = requiredPermissions.filter((p) => !permissions.has(p));
  return missingPermissions.length == 0;
}

export function parseUserRole(role: string | null): UserRole {
  switch (role) {
    case 'root':
      return UserRole.ROOT;
    case 'whitelabel-root':
      return UserRole.WHITELABEL_ROOT;
    case 'admin':
      return UserRole.ADMIN;
    case 'user':
    default:
      return UserRole.USER;
  }
}
export function getUserRole(user: FlagrightAuth0User | Account | null): UserRole {
  return parseUserRole(user?.role ?? null);
}

export function isSuperAdmin(user: FlagrightAuth0User | Account | null) {
  return isAtLeast(user, UserRole.ROOT);
}

export function isAbove(user: FlagrightAuth0User | Account | null, role: UserRole) {
  return ROLES_ORDER.indexOf(getUserRole(user)) < ROLES_ORDER.indexOf(role);
}

export function isAtLeast(user: FlagrightAuth0User | Account | null, role: UserRole) {
  if (ROLES_ORDER.indexOf(getUserRole(user)) > ROLES_ORDER.indexOf(role)) {
    return false;
  }
  if (role === UserRole.ROOT && user) {
    const email = 'verifiedEmail' in user ? user.verifiedEmail : user.email;

    const isFlagrightEmail = email?.endsWith('@flagright.com') ?? false;

    if (!isFlagrightEmail) {
      return false;
    }
  }
  return true;
}

export function isAtLeastAdmin(user: FlagrightAuth0User | null) {
  return isAtLeast(user, UserRole.ADMIN);
}

export function useRoles(): [AccountRole[], boolean] {
  const api = useApi();
  const rolesQueryResult = useQuery(ROLES_LIST(), async () => {
    return await api.getRoles();
  });
  return [getOr(rolesQueryResult.data, []), isLoading(rolesQueryResult.data)];
}

export function useAccountsQueryResult(): QueryResult<Account[]> {
  const api = useApi();
  return useQuery(ACCOUNT_LIST(), async () => {
    try {
      return await api.getAccounts();
    } catch (e) {
      console.error(e);
      return [];
    }
  });
}

export function useUsers(
  options: { includeRootUsers?: boolean; includeBlockedUsers?: boolean } = {
    includeRootUsers: false,
    includeBlockedUsers: false,
  },
): [{ [userId: string]: Account }, boolean] {
  const user = useAuth0User();
  const usersQueryResult = useAccountsQueryResult();
  const users = getOr(usersQueryResult.data, []);
  const isSuperAdmin = isAtLeast(user, UserRole.ROOT);

  let tempUsers = [...users, ...SYSTEM_USERS];

  if (!options.includeRootUsers && !isSuperAdmin) {
    tempUsers = tempUsers.filter((user) => {
      const role = parseUserRole(user.role);
      return role !== UserRole.ROOT && role !== UserRole.WHITELABEL_ROOT;
    });
  }

  if (!options.includeBlockedUsers) {
    tempUsers = tempUsers.filter((user) => !user.blocked);
  }
  return [keyBy(tempUsers, 'id'), isLoading(usersQueryResult.data)];
}

export function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return {
    invalidate: () => {
      queryClient.invalidateQueries(ACCOUNT_LIST());
    },
  };
}

export function useUserName(userId: string | null | undefined): string {
  const [users, isLoading] = useUsers();
  // todo: i18n
  if (isLoading || !userId) {
    return userId ?? 'Unknown user';
  }
  return users[userId]?.name ?? userId ?? 'Unknown user';
}

export function useUser(userId: string | null | undefined): Account | null {
  const [users, isLoading] = useUsers({ includeBlockedUsers: true, includeRootUsers: true });

  if (isLoading || !userId) {
    return null;
  }
  const user = users[userId];
  if (user && (isSuperAdmin(user) || user.role === UserRole.WHITELABEL_ROOT)) {
    return {
      ...user,
      name: 'System',
      email: 'system',
      picture: undefined,
    };
  }

  return user;
}

export function useSortedUsers(
  options: {
    includeRootUsers?: boolean;
    includeBlockedUsers?: boolean;
  } = {
    includeRootUsers: false,
    includeBlockedUsers: false,
  },
): [Account[], boolean] {
  const [users, loading] = useUsers(options);
  return [
    Object.values(users).sort((accountA, accountB) => accountA.name.localeCompare(accountB.name)),
    loading,
  ];
}

export const Context = React.createContext<{ user: FlagrightAuth0User } | null>(null);

export const isFlagrightInternalUser = (user: FlagrightAuth0User) => {
  return user.verifiedEmail?.endsWith('@flagright.com') ?? false;
};
