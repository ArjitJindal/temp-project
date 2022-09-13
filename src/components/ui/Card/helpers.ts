import { useEffect, useState } from 'react';

export type CollapseKey = (string | number)[];

export function useLocalStorageState(
  collapsableKey: CollapseKey | undefined,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] {
  const [state, setState] = useState<boolean>(defaultValue);
  const fullCollapseKey = collapsableKey
    ? ['Card', 'collapseState', collapsableKey].join('__')
    : null;

  useEffect(() => {
    if (fullCollapseKey != null) {
      const savedState = window.localStorage.getItem(fullCollapseKey);
      if (savedState != null) {
        setState(savedState === 'true');
        // setCollapsed(savedState === 'true');
      }
    }
  }, [fullCollapseKey]);

  const onChangeKey = (value: boolean) => {
    setState(value);
    if (fullCollapseKey != null) {
      window.localStorage.setItem(fullCollapseKey, `${value}`);
    }
  };

  return [state, onChangeKey];
}
