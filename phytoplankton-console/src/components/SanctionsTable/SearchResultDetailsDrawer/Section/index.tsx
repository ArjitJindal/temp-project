import React from 'react';
import s from './index.module.less';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function Section(props: Props) {
  const { children, title } = props;
  return (
    <div className={s.root}>
      <div className={s.header}>{title}</div>
      {children}
    </div>
  );
}
