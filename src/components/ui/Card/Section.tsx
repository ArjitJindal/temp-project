import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  direction?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
}

export default function Section(props: Props) {
  const { direction = 'vertical', children } = props;
  return <div className={cn(s.section, s[direction])}>{children}</div>;
}
