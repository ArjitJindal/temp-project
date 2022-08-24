import { useState } from 'react';
import { useDebounceEffect } from 'ahooks';
import { User } from './types';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';

type UsersResponse = {
  total: number;
  users: User[];
};

export function useUsers(search: string): AsyncResource<UsersResponse> {
  const api = useApi();
  const [state, setState] = useState<AsyncResource<UsersResponse>>(init());
  useDebounceEffect(
    () => {
      let isCancelled = false;
      setState((lastState) => loading(getOr(lastState, null)));
      // todo: implement cancelation
      Promise.all([
        api.getConsumerUsersList({
          limit: 10,
          skip: 0,
          beforeTimestamp: Date.now(),
          filterId: search,
          filterName: search,
          filterOperator: 'OR',
        }),
        api.getBusinessUsersList({
          limit: 10,
          skip: 0,
          beforeTimestamp: Date.now(),
          filterId: search,
          filterName: search,
          filterOperator: 'OR',
        }),
      ])
        .then(([consumerUsers, businessUsers]) => {
          if (isCancelled) {
            return;
          }
          setState(
            success({
              total: consumerUsers.total + businessUsers.total,
              users: [...consumerUsers.data, ...businessUsers.data],
            }),
          );
        })
        .catch((e) => {
          if (isCancelled) {
            return;
          }
          setState(failed(getErrorMessage(e)));
        });

      return () => {
        isCancelled = true;
      };
    },
    [search, api],
    {
      wait: 300,
    },
  );

  return state;
}
