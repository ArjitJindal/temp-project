import React, { useEffect } from 'react';
import { useAuth0User } from '@/utils/user-utils';

/**
 * We have console and API deployed in different AWS geo-instances, and different tenants are placed in different
 * tenants are placed in different instances. If we are currently in a wrong instance - redirect to the right instance.
 * User should have proper host in Auth0 app_metadata to make it work
 */
export default function ZoneRedirect(props: { children: React.ReactNode }): JSX.Element {
  const user = useAuth0User();
  const tenantConsoleHost = user?.tenantConsoleHost;
  useEffect(() => {
    if (tenantConsoleHost && window.location.host !== tenantConsoleHost) {
      window.location.host = tenantConsoleHost;
    }
  }, [tenantConsoleHost]);
  return <>{props.children}</>;
}
