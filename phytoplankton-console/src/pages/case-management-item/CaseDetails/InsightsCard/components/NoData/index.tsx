import cn from 'clsx';
import React from 'react';
import s from './styles.module.less';

export default function NoData() {
  return <div className={cn(s.root)}>No data for chart</div>;
}
