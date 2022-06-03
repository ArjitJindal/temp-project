import { useEffect, useState } from 'react';
import _ from 'lodash';
import type { User } from 'auth0';
import { useAuth0 } from '@auth0/auth0-react';
import { useApi } from '@/api';

// todo: rename file and utils to use "account" instead of "user" in names
export enum UserRole {
  ROOT,
  ADMIN,
  USER,
}

export interface FlagrightAuth0User {
  name: string | null;
  picture: string | null;
  role: string | null;
  tenantId: string;
  tenantName: string;
  userId: string | null;
  tenantConsoleHost: string | null;
}

let cachedUsers: { [userId: string]: User } | null = null;

const NAMESPACE = 'https://flagright.com';

export function useAuth0User(): FlagrightAuth0User | null {
  const { user } = useAuth0();
  if (user == null) {
    return null;
  }
  return {
    name: user.name ?? null,
    picture: user.picture ?? null,
    role: user[`${NAMESPACE}/role`] ?? null,
    tenantId: user[`${NAMESPACE}/tenantId`],
    tenantName: user[`${NAMESPACE}/tenantName`],
    userId: user[`${NAMESPACE}/userId`] ?? null,
    tenantConsoleHost: user[`${NAMESPACE}/tenantConsoleHost`] ?? null,
  };
}

export function isFlagrightTenantUser(user: FlagrightAuth0User): boolean {
  return user.tenantId === 'flagright';
}

export function getUserRole(user: FlagrightAuth0User | null): UserRole {
  const role = user?.role;
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

export function isAtLeastAdmin(user: FlagrightAuth0User | null) {
  return getUserRole(user).valueOf() <= UserRole.ADMIN.valueOf();
}

export function useUsers(): [{ [userId: string]: User }, boolean] {
  const [users, setUsers] = useState<{ [userId: string]: User }>({});
  const [loading, setLoading] = useState(true);
  const api = useApi();
  useEffect(() => {
    if (cachedUsers) {
      setUsers(cachedUsers);
      setLoading(false);
    } else {
      api.getAccounts({}).then((accounts: User[]) => {
        cachedUsers = _.keyBy(accounts, 'user_id');
        setUsers(cachedUsers);
        setLoading(false);
      });
    }
  }, [api, users]);
  return [users, loading];
}

export function useUserName(userId: string | null | undefined): string {
  const [users, isLoading] = useUsers();
  // todo: i18n
  if (isLoading || !userId) {
    return userId ?? 'Unknown user';
  }
  return users[userId]?.name ?? userId ?? 'Unknown user';
}
