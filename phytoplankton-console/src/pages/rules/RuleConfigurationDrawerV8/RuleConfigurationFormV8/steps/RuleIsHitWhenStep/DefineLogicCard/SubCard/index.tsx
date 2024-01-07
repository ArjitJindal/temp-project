import React from 'react';
import s from './style.module.less';

interface Props {
  children: React.ReactNode;
}

export default function SubCard(props: Props) {
  const { children } = props;
  return <div className={s.root}>{children}</div>;
}
