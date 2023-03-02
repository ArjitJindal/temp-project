import React, { useContext, useEffect, useState } from 'react';
import _ from 'lodash';
import { useApi } from '@/api';
import { Account, Permission } from '@/apis';

// todo: rename file and utils to use "account" instead of "user" in names
export enum UserRole {
  ROOT = 'root',
  ADMIN = 'admin',
  USER = 'user',
}

export const ROLES_ORDER = ['root', 'admin', 'user'];

export interface FlagrightAuth0User {
  name: string | null;
  picture: string | null;
  role: string | null;
  userId: string;
  verifiedEmail: string | null;
  tenantId: string;
  tenantName: string;
  tenantConsoleApiUrl: string;
  demoMode: boolean;
  permissions?: Map<Permission, boolean>;
}
let cachedUsers: Promise<Account[]> | null = null;

export const NAMESPACE = 'https://flagright.com';

export function useAuth0User(): FlagrightAuth0User {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Account context is not initialized properly`);
  }
  return context.user;
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
    case 'admin':
      return UserRole.ADMIN;
    case 'user':
    default:
      return UserRole.USER;
  }
}
export function getUserRole(user: FlagrightAuth0User | null): UserRole {
  return parseUserRole(user?.role ?? null);
}

export function isAtLeast(user: FlagrightAuth0User | null, role: UserRole) {
  if (ROLES_ORDER.indexOf(getUserRole(user)) > ROLES_ORDER.indexOf(role)) {
    return false;
  }
  if (role === UserRole.ROOT) {
    const isFlagrightEmail = user?.verifiedEmail?.endsWith('@flagright.com') ?? false;
    if (!isFlagrightEmail) {
      return false;
    }
  }
  return true;
}

export function isAtLeastAdmin(user: FlagrightAuth0User | null) {
  return isAtLeast(user, UserRole.ADMIN);
}

export function useUsers(
  includeUsersObject: { includeRootUsers?: boolean; includeBlockedUsers?: boolean } = {
    includeRootUsers: false,
    includeBlockedUsers: false,
  },
): [{ [userId: string]: Account }, boolean] {
  const [users, setUsers] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();
  useEffect(() => {
    if (!cachedUsers) {
      cachedUsers = api
        .getAccounts({})
        .then((accounts: Account[]) => accounts)
        .catch(() => []);
    }
    cachedUsers.then((users) => {
      setUsers(users);
      setLoading(false);
    });
  }, [api, users]);

  let tempUsers = users;
  if (!includeUsersObject.includeRootUsers) {
    tempUsers = users.filter((user) => parseUserRole(user.role) !== UserRole.ROOT);
  }
  if (!includeUsersObject.includeBlockedUsers) {
    tempUsers = users.filter((user) => !user.blocked);
  }
  return [_.keyBy(tempUsers, 'id'), loading];
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
  return users[userId];
}

// export async function useAccountSettings(): AsyncResource<AccountSettings> {
//   const api = useApi();
//   const { userId } = useAuth0User();
//   const result = useQuery(ACCOUNT_ITEM_SETTINGS(userId ?? null), async () => {
//     if (userId == null) {
//       return {};
//     }
//     return await api.accountGetSettings({
//       accountId: userId,
//     });
//   });
//   return result.data;
// }

export const Context = React.createContext<{ user: FlagrightAuth0User } | null>(null);
