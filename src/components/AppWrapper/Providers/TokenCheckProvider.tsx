import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useApi } from '@/api';
import { useAuth0User } from '@/utils/user-utils';

export default function TokenCheckProvider(props: { children: React.ReactNode }) {
  const api = useApi();
  const user = useAuth0User();
  const { logout } = useAuth();

  useEffect(() => {
    api.me().then((me) => {
      if (me.role && user.role && me.role !== user.role) {
        logout();
      }
    });
  }, [api, logout, user.role]);

  return <>{props.children}</>;
}
