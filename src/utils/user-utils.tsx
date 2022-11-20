import React, { useEffect, useState, useMemo, useContext } from 'react';
import _ from 'lodash';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from 'antd';
import * as Sentry from '@sentry/browser';
import { useApi } from '@/api';
import ErrorPage from '@/components/ErrorPage';
import { Account } from '@/apis';

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
  tenantApiAudience: string;
}

let cachedUsers: Promise<Account[]> | null = null;

const NAMESPACE = 'https://flagright.com';

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

export function useUsers(includeRootUsers = false): [{ [userId: string]: Account }, boolean] {
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
  if (!includeRootUsers) {
    tempUsers = users.filter((user) => parseUserRole(user.role) !== UserRole.ROOT);
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
  const [users, isLoading] = useUsers();
  if (isLoading || !userId) {
    return null;
  }
  return users[userId];
}

const Context = React.createContext<{ user: FlagrightAuth0User } | null>(null);

export function FlagrightUserProvider(props: { children: React.ReactNode }) {
  const { user, logout, loginWithRedirect } = useAuth0();
  const flagrightUser: FlagrightAuth0User | 'ORPHAN' | null = useMemo(() => {
    if (user == null) {
      return null;
    }
    const tenantConsoleApiUrl: string | null = user[`${NAMESPACE}/tenantConsoleApiUrl`];
    const tenantApiAudience: string | null = user[`${NAMESPACE}/tenantApiAudience`];
    const tenantId: string | null = user[`${NAMESPACE}/tenantId`];
    const tenantName: string | null = user[`${NAMESPACE}/tenantName`];
    const verifiedEmail: string | null = user[`${NAMESPACE}/verifiedEmail`];

    if (
      tenantConsoleApiUrl == null ||
      tenantApiAudience == null ||
      tenantId == null ||
      tenantName == null
    ) {
      return 'ORPHAN';
    }

    const name = user.name ?? '-';

    const appUser = {
      name: name,
      picture: user.picture ?? null,
      role: user[`${NAMESPACE}/role`] ?? 'user',
      userId: user[`${NAMESPACE}/userId`] ?? null,
      tenantId: tenantId,
      tenantName: tenantName,
      tenantConsoleApiUrl: tenantConsoleApiUrl,
      tenantApiAudience: tenantApiAudience,
      verifiedEmail: verifiedEmail ?? null,
    };

    Sentry.setUser({
      id: appUser.userId,
      email: appUser.verifiedEmail ?? undefined,
      username: appUser.name ?? undefined,
    });
    Sentry.setTag('tenant', `${appUser.tenantId} (${appUser.tenantName})`);

    return appUser;
  }, [user]);
  if (flagrightUser == null) {
    // todo: i18n
    return (
      <ErrorPage title={'Unauthorized'}>
        <p>Please, log in</p>
        <Button onClick={() => loginWithRedirect()}>Log in</Button>
      </ErrorPage>
    );
  }
  if (flagrightUser === 'ORPHAN') {
    // todo: i18n
    return (
      <ErrorPage title={'User Not Provisioned'}>
        <p>
          User does not have a provisioned Flagright Account. If your organization already uses
          Flagright, please ask your Flagright Console Admin to add you to the Console. If you are
          not a Flagright customer yet, please contact Flagright Sales Team at hello@flagright.com
        </p>
        <Button onClick={() => logout()}>Log out</Button>
      </ErrorPage>
    );
  }

  return <Context.Provider value={{ user: flagrightUser }}>{props.children}</Context.Provider>;
}
