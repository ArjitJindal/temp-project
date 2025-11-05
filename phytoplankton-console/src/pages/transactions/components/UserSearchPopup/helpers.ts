import { useCallback } from 'react';
import { useSafeLocalStorageState } from '@/utils/hooks';

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
