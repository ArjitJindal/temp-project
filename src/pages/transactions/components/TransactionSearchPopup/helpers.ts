import { useCallback } from 'react';
import { useLocalStorageState } from 'ahooks';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { TRANSACTIONS_FIND } from '@/utils/queries/keys';
import { QueryResult } from '@/utils/queries/types';
import { Transaction } from '@/apis';

type TransactionResponse = {
  total: number;
  transactions: Transaction[];
};

const LOCAL_STORAGE_KEY = 'FIND_TRANSACTIONS_LAST_SEARCH';

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

export function useTransactions(search: string): QueryResult<TransactionResponse> {
  const api = useApi();

  return useQuery(TRANSACTIONS_FIND(search), async (): Promise<TransactionResponse> => {
    if (search === '') {
      return {
        total: 0,
        transactions: [],
      };
    }

    const response = await api.getTransactionsList({
      filterId: search,
      limit: 10,
      skip: 0,
      beforeTimestamp: Date.now(),
    });

    return {
      total: response.total,
      transactions: response.data,
    };
  });
}
