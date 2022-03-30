import { useEffect, useState } from 'react';
import _ from 'lodash';
import type { User } from 'auth0';
import { useApi } from '@/api';

let cachedUsers: { [userId: string]: User } | null = null;

export function isFlagrightUser(user: User): boolean {
  return user['https://flagright.com/tenantId'] === 'flagright';
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
