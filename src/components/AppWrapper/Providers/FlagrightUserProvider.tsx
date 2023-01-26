import React, { useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import * as Sentry from '@sentry/browser';
import { Button } from 'antd';
import ErrorPage from '@/components/ErrorPage';
import { Context, FlagrightAuth0User, NAMESPACE } from '@/utils/user-utils';

export default function FlagrightUserProvider(props: { children: React.ReactNode }) {
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
    const demoMode: boolean | null = user[`${NAMESPACE}/demoMode`];

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
      demoMode: demoMode === true,
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
