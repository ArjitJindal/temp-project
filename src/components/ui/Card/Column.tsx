import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  direction?: 'horizontal' | 'vertical';
  children?: React.ReactNode;
  className?: string;
}

export default function Column(props: Props) {
  const { children, className } = props;
  return <div className={cn(s.column, className)}>{children}</div>;
}
