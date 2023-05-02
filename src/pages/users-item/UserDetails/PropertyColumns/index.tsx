import React from 'react';
import s from './index.module.less';

interface Props {
  children: React.ReactNode;
}

export function PropertyColumns(props: Props) {
  const { children } = props;
  return <div className={s.table}>{children}</div>;
}
