import { useCallback } from 'react';
import { useLocalStorageState } from 'ahooks';

export function useLastSearches(key: string): {
  items: string[];
  onAdd: (item: string) => void;
} {
  const [items, setItems] = useLocalStorageState<string[]>(key, []);
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
