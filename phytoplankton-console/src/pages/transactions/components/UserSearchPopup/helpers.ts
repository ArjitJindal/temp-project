import { useCallback } from 'react';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { USERS_FIND } from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { AllUsersTableItem } from '@/apis';
import { useSafeLocalStorageState } from '@/utils/hooks';

type UsersResponse = {
  total: number;
  users: AllUsersTableItem[];
};

const LOCAL_STORAGE_KEY = 'FIND_USER_LAST_SEARCHES';

export function useLastSearches(): {
  items: string[];
  onAdd: (item: string) => void;
} {
  const [items, setItems] = useSafeLocalStorageState<string[]>(LOCAL_STORAGE_KEY, []);
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

export function useUsers(search: string): QueryResult<UsersResponse> {
  const api = useApi();

  return useQuery(USERS_FIND(search), async (): Promise<UsersResponse> => {
    if (search === '') {
      return {
        total: 0,
        users: [],
      };
    }

    const users = await api.getAllUsersList({
      beforeTimestamp: Date.now(),
      filterId: search,
      filterName: search,
      filterOperator: 'OR',
      includeCasesCount: true,
    });

    return {
      total: users.count,
      users: users.items,
    };
  });
}
