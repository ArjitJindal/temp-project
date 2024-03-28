import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  children: React.ReactNode;
}

export default function TagList(props: Props) {
  const { children } = props;

  return <div className={cn(s.root)}>{children}</div>;
}
