import React from 'react';
import s from './index.module.less';

export default function Component(props: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.root}>
      <div className={s.title}>{props.title}</div>
      <div className={s.content}>{props.children}</div>
    </div>
  );
}
