import { useEffect, useState } from 'react';
import _ from 'lodash';
import type { User } from 'auth0';
import { useApi } from '@/api';

export enum UserRole {
  ROOT,
  ADMIN,
  USER,
}

let cachedUsers: { [userId: string]: User } | null = null;

export function isFlagrightUser(user: User): boolean {
  return user['https://flagright.com/tenantId'] === 'flagright';
}

export function getUserTenant(user: User): { tenantId: string; tenantName: string } {
  return {
    tenantId: user['https://flagright.com/tenantId'],
    tenantName: user['https://flagright.com/tenantName'],
  };
}

export function getUserRole(user: User | undefined): UserRole {
  const role = user?.['https://flagright.com/role'];
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

export function isAtLeastAdmin(user: User | undefined) {
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
