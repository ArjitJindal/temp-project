import React from 'react';
import s from './index.module.less';
import Column from './Column';

interface Props {
  children: React.ReactNode;
}

export default function Root(props: Props) {
  return (
    <div className={s.root}>
      <Column>{props.children}</Column>
    </div>
  );
}
