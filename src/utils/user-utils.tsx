import React, { useEffect, useState, useMemo, useContext } from 'react';
import _ from 'lodash';
import type { User } from 'auth0';
import { useAuth0 } from '@auth0/auth0-react';
import { Button } from 'antd';
import * as Sentry from '@sentry/browser';
import { useApi } from '@/api';
import ErrorPage from '@/components/ErrorPage';

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
  userId: string;
  verifiedEmail: string | null;
  tenantId: string;
  tenantName: string;
  tenantConsoleApiUrl: string;
  tenantApiAudience: string;
}

let cachedUsers: { [userId: string]: User } | null = null;

const NAMESPACE = 'https://flagright.com';

export function useAuth0User(): FlagrightAuth0User {
  const context = useContext(Context);
  if (context == null) {
    throw new Error(`Account context is not initialized properly`);
  }
  return context.user;
}

export function isFlagrightTenantUser(user: FlagrightAuth0User): boolean {
  return user.tenantId === 'flagright';
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
  if (getUserRole(user).valueOf() > role.valueOf()) {
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

export function useUsers(): [{ [userId: string]: User }, boolean] {
  const [users, setUsers] = useState<{ [userId: string]: User }>({});
  const [loading, setLoading] = useState(true);
  const api = useApi();
  useEffect(() => {
    if (cachedUsers) {
      setUsers(cachedUsers);
      setLoading(false);
    } else {
      api.getAccounts({}).then(
        (accounts: User[]) => {
          cachedUsers = _.keyBy(accounts, 'user_id');
          setUsers(cachedUsers);
          setLoading(false);
        },
        () => {
          cachedUsers = {};
          setUsers({});
          setLoading(false);
        },
      );
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
      <ErrorPage title={'Orphan user'}>
        <p>
          User doesn't belong to any tenant. Please contact us to include you to proper organization
        </p>
        <Button onClick={() => logout()}>Log out</Button>
      </ErrorPage>
    );
  }

  return <Context.Provider value={{ user: flagrightUser }}>{props.children}</Context.Provider>;
}
