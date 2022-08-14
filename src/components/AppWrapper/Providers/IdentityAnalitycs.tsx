import React, { useEffect } from 'react';
import { useAnalytics } from '@/utils/segment/context';
import { useAuth0User } from '@/utils/user-utils';

interface Props {
  children: React.ReactNode;
}

export default function IdentityAnalytics(props: Props) {
  const analitycs = useAnalytics();
  const user = useAuth0User();
  useEffect(() => {
    analitycs.identify(user.userId, user);
    analitycs.tenant(user.tenantId, {
      apiHost: new URL(user.tenantConsoleApiUrl).host,
    });
  }, [analitycs, user.userId, user.tenantId, user.tenantConsoleApiUrl, user.tenantName, user]);
  return <>{props.children}</>;
}
