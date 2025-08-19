import React, { useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keyBy } from 'lodash';
import { hasResources, Resource } from '@flagright/lib/utils';
import { useQuery } from './queries/hooks';
import { ACCOUNT_LIST, ROLES_LIST } from './queries/keys';
import { getOr, isLoading } from './asyncResource';
import { QueryResult } from './queries/types';
import { getBranding } from './branding';
import { useApi } from '@/api';
import { Account, AccountRole, Permission, PermissionStatements } from '@/apis';
import { useSettings, useResources } from '@/components/AppWrapper/Providers/SettingsProvider';

export enum CommentType {
  COMMENT,
  USER,
  SHAREHOLDERDIRECTOR,
}

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

export const MAX_LOGIN_ATTEMPTS_BEFORE_BLOCKING = 3;

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
  orgName: string | null;
}

const SYSTEM_USERS: Account[] = [
  {
    name: FLAGRIGHT_SYSTEM_USER,
    email: FLAGRIGHT_SYSTEM_USER,
    picture: undefined,
    role: UserRole.USER,
    id: FLAGRIGHT_SYSTEM_USER,
    emailVerified: true,
    blocked: false,
    orgName: 'flagright',
    tenantId: 'flagright',
  },
  {
    name: API_USER,
    email: API_USER,
    picture: undefined,
    role: UserRole.USER,
    id: API_USER,
    emailVerified: true,
    blocked: false,
    orgName: 'flagright',
    tenantId: 'flagright',
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
  const userId = useCurrentUserId();
  return users[userId];
}

export function useCurrentUserId(): string {
  const user = useAuth0User();
  return user.userId;
}

export function useAccountRole(): UserRole {
  const rawRole = useAccountRawRole();

  return parseUserRole(rawRole);
}

export function useAccountRawRole(): string | null {
  const user = useAuth0User();
  return user?.role ?? null;
}

export function usePermissions(): Map<Permission, boolean> {
  const user = useAuth0User();
  return user.permissions || new Map<Permission, boolean>();
}

export function hasMinimumPermission(
  statements: PermissionStatements[],
  requiredResources: Resource[],
): boolean {
  if (requiredResources.length === 0) {
    return true;
  }

  const resourcesByAction = requiredResources.reduce((acc, resource) => {
    const [action, resourcePath] = resource.split(':::');
    if (!acc[action]) {
      acc[action] = [];
    }
    acc[action].push(resourcePath);
    return acc;
  }, {} as Record<string, string[]>);

  return Object.entries(resourcesByAction).every(([action, resources]) => {
    return statements.some((statement) => {
      let hasAction = false;
      if (action === 'read') {
        hasAction = statement.actions.includes('read') || statement.actions.includes('write');
      } else {
        hasAction = statement.actions.includes(action as 'read' | 'write');
      }

      if (!hasAction) {
        return false;
      }

      return statement.resources.some((statementResource) => {
        const [, normalizedResource] = statementResource.split(':::');
        if (!normalizedResource) {
          return false;
        }

        return resources.some((requiredResource) => {
          if (normalizedResource === requiredResource || normalizedResource === '*') {
            return true;
          } else if (
            normalizedResource.endsWith('/*') &&
            requiredResource.startsWith(normalizedResource.slice(0, -2))
          ) {
            return true;
          } else if (
            requiredResource.endsWith('/*') &&
            normalizedResource.startsWith(requiredResource.slice(0, -2))
          ) {
            return true;
          }
          return false;
        });
      });
    });
  });
}

// Keep the hook as a wrapper for convenience
export function useHasMinimumPermission(requiredResources: Resource[]): boolean {
  const { statements } = useResources();
  return hasMinimumPermission(statements, requiredResources);
}

export function useHasResources(requiredResources: Resource[]): boolean {
  const { statements } = useResources();
  return hasResources(statements, requiredResources);
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

export function useRolesQueryResult() {
  const api = useApi();
  return useQuery(ROLES_LIST(), async () => {
    const roles = await api.getRoles();
    return {
      items: roles,
      total: roles.length,
    };
  });
}

export function useRoles(): [AccountRole[], boolean, () => void] {
  const rolesQueryResult = useRolesQueryResult();
  return [
    getOr(rolesQueryResult.data, { items: [], total: 0 }).items,
    isLoading(rolesQueryResult.data),
    rolesQueryResult.refetch,
  ];
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
  options: {
    includeRootUsers?: boolean;
    includeBlockedUsers?: boolean;
    includeSystemUsers?: boolean;
  } = {
    includeRootUsers: false,
    includeBlockedUsers: false,
    includeSystemUsers: true,
  },
): [{ [userId: string]: Account }, boolean] {
  const user = useAuth0User();
  const usersQueryResult = useAccountsQueryResult();
  const users = getOr(usersQueryResult.data, []);
  const isSuperAdmin = isAtLeast(user, UserRole.ROOT);

  let tempUsers = [...users, ...(options.includeSystemUsers ? SYSTEM_USERS : [])];

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
  const settings = useSettings();
  // todo: i18n
  if (isLoading || !userId) {
    return userId ?? `Unknown ${settings.userAlias}`;
  }
  return users[userId]?.name ?? userId ?? `Unknown ${settings.userAlias}`;
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
    includeSystemUsers?: boolean;
  } = {
    includeRootUsers: false,
    includeBlockedUsers: false,
    includeSystemUsers: false,
  },
): [Account[], boolean] {
  const currentUser = useAuth0User();
  const [users, loading] = useUsers(options);
  return [
    Object.values(users)
      .sort((accountA, accountB) => {
        if (currentUser.userId === accountA.id || currentUser.userId === accountB.id) {
          return -1;
        }

        return accountA.name.localeCompare(accountB.name);
      })
      .filter((account) => !isSystemUser(account.id)),
    loading,
  ];
}

export const Context = React.createContext<{ user: FlagrightAuth0User } | null>(null);

export const isFlagrightInternalUser = (user: FlagrightAuth0User) => {
  return user.verifiedEmail?.endsWith('@flagright.com') ?? false;
};

const getAccountUserName = (account: Account | undefined, defaultStr?: string): string => {
  if (account == null && defaultStr != null) {
    return defaultStr;
  }
  return (account?.name || account?.email || account?.id) + (account?.blocked ? ' (Deleted)' : '');
};

export function isSystemUser(id: string): boolean {
  return SYSTEM_USERS.some((systemUser) => systemUser.id === id);
}

export function getDisplayedUserInfo(account?: Account | null): { name: string; avatar?: string } {
  const branding = getBranding();
  if (account && isSystemUser(account.id)) {
    return { name: account.name ?? account.email ?? account.id, avatar: branding.systemAvatarUrl };
  }
  if (!account || isSuperAdmin(account) || account.role === UserRole.WHITELABEL_ROOT) {
    return { name: `${branding.companyName} System`, avatar: branding.systemAvatarUrl };
  }
  return { name: getAccountUserName(account), avatar: account.picture };
}

export function getAvatarText(name: string): string {
  if (!name) {
    return 'N';
  }

  const words = name.trim().split(/\s+/);
  const firstInitial = words[0][0];
  const lastInitial = words.length > 1 ? words[words.length - 1][0] : '';

  return firstInitial + lastInitial;
}
