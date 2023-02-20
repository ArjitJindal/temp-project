import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useApi } from '@/api';
import { useAuth0User } from '@/utils/user-utils';

export default function TokenCheckProvider(props: { children: React.ReactNode }) {
  const api = useApi();
  const user = useAuth0User();
  const { refreshAccessToken } = useAuth();

  useEffect(() => {
    const checkToken = async () => {
      const me = await api.me();
      if (me.role && user.role && me.role !== user.role) {
        await refreshAccessToken();
      }
    };
    checkToken().catch(console.error);
  }, [api, refreshAccessToken, user?.role]);

  return <>{props.children}</>;
}
