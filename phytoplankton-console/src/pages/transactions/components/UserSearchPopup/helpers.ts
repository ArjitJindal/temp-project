import { useCallback } from 'react';
import { useUsersPreviewSearch } from '@/hooks/api';
import { QueryResult } from '@/utils/queries/types';
import { AllUsersTableItemPreview, UserType } from '@/apis';
import { useSafeLocalStorageState } from '@/utils/hooks';

type UsersResponse = {
  total: number;
  users: AllUsersTableItemPreview[];
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

export function useUsersSearch(
  search: string,
  userType?: UserType,
  filterType?: 'id' | 'name',
): QueryResult<UsersResponse> {
  const result = useUsersPreviewSearch(search, userType, filterType);
  return {
    data: result.data as any as any,
    refetch: result.refetch,
  } as QueryResult<UsersResponse>;
}
