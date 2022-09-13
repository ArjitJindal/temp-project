import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  direction?: 'horizontal' | 'vertical';
  justify?: 'start' | 'end' | 'space-between';
  align?: 'start' | 'end' | 'stretch';
  spacing?: 'default' | 'double';
  children?: React.ReactNode;
  className?: string;
}

export default function Section(props: Props) {
  const {
    direction = 'vertical',
    justify = 'start',
    align = 'stretch',
    spacing = 'default',
    className,
    children,
  } = props;
  return (
    <div
      className={cn(
        s.section,
        s[`direction-${direction}`],
        s[`justify-${justify}`],
        s[`align-${align}`],
        s[`spacing-${spacing}`],
        className,
      )}
    >
      {children}
    </div>
  );
}
