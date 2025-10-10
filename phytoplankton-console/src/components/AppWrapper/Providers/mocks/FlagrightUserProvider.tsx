import React from 'react';
import { Context } from '@/utils/user-utils';
import { Permission } from '@/apis';
import { PERMISSIONS } from '@/apis/models-custom/Permission';

export default function FlagrightUserProviderMock_(props: { children: React.ReactNode }) {
  const permissions = new Map<Permission, boolean>();
  PERMISSIONS.map((p) => permissions.set(p, true));
  return (
    <Context.Provider
      value={{
        user: {
          role: 'root',
          userId: 'mock_id',
          name: 'Mock user',
          picture: null,
          verifiedEmail: 'mock@example.com',
          tenantId: 'mock',
          tenantName: 'Mock Tenant',
          region: 'eu',
          tenantConsoleApiUrl: 'https://example.com/mock',
          demoMode: false,
          permissions,
          allowTenantDeletion: false,
          allowedRegions: ['eu-1'],
          orgName: 'flagright',
        },
      }}
    >
      {props.children}
    </Context.Provider>
  );
}
