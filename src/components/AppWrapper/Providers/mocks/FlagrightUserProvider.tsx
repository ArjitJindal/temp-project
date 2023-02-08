import React from 'react';
import { Context } from '@/utils/user-utils';

export default function FlagrightUserProviderMock(props: { children: React.ReactNode }) {
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
          tenantConsoleApiUrl: 'https://example.com/mock',
          demoMode: false,
        },
      }}
    >
      {props.children}
    </Context.Provider>
  );
}
