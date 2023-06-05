import React from 'react';
import s from './index.module.less';

interface Props {
  children?: string;
}

export default function EntityId(props: Props) {
  const { children } = props;

  return <div className={s.root}>{children}</div>;
}
