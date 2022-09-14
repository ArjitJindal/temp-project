import { useCallback, useState } from 'react';
import { useDebounceEffect, useLocalStorageState } from 'ahooks';
import { User } from './types';
import { AsyncResource, failed, getOr, init, loading, success } from '@/utils/asyncResource';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';

type UsersResponse = {
  total: number;
  users: User[];
};

const LOCAL_STORAGE_KEY = 'FIND_USER_LAST_SEARCHES';

export function useLastSearches(): {
  items: string[];
  onAdd: (item: string) => void;
} {
  const [items, setItems] = useLocalStorageState<string[]>(LOCAL_STORAGE_KEY, []);
  const onAdd = useCallback(
    (item) => {
      setItems((previousState) =>
        [item, ...(previousState ?? []).filter((x) => x !== item)].slice(0, 3),
      );
    },
    [setItems],
  );
  return {
    items,
    onAdd,
  };
}

export function useUsers(search: string): AsyncResource<UsersResponse> {
  const api = useApi();
  const [state, setState] = useState<AsyncResource<UsersResponse>>(init());
  useDebounceEffect(
    () => {
      if (search === '') {
        setState(
          success({
            total: 0,
            users: [],
          }),
        );
        return;
      }
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
