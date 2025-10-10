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
