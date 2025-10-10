import { useCallback } from 'react';
import { useSafeLocalStorageState } from '@/utils/hooks';

export function useLastSearches(key: string): {
  items: string[];
  onAdd: (item: string) => void;
} {
  const [items, setItems] = useSafeLocalStorageState<string[]>(key, []);
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
