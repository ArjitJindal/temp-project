import React from 'react';
import s from './index.module.less';

interface Props {
  children: string;
}

export default function RuleSummary(props: Props) {
  const { children } = props;

  return (
    <div className={s.root}>
      <div className={s.title}>{'Rule summary'}</div>
      <div className={s.children}>{children}</div>
    </div>
  );
}
