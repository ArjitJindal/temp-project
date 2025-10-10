import cn from 'clsx';
import React from 'react';
import s from './index.module.less';

interface Props {
  children: React.ReactNode;
}

export default function DefaultChartTooltip(props: Props) {
  const { children } = props;

  return <div className={cn(s.root)}>{children}</div>;
}
