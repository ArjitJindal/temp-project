import { useEffect, useState } from 'react';

export interface CommonContainerProps {
  justify?: 'start' | 'end' | 'space-between' | 'evenly';
  align?: 'start' | 'end' | 'stretch';
  spacing?: 'none' | 'default' | 'double';
  border?: boolean;
}

export function getCommonContainerClasses(
  s: Record<string, string>,
  props: CommonContainerProps,
  defaults: Partial<CommonContainerProps> = {},
) {
  const {
    justify = 'start',
    align = 'stretch',
    spacing = 'none',
    border = true,
  } = {
    ...props,
    ...defaults,
  };
  return [
    s[`justify-${justify}`],
    s[`align-${align}`],
    s[`spacing-${spacing}`],
    border ? s['border'] : '',
  ];
}

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
