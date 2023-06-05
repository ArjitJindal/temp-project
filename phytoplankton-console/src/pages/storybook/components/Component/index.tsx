import React from 'react';
import s from './index.module.less';
import ErrorBoundary from '@/components/ErrorBoundary';
import Compasses2LineIcon from '@/components/ui/icons/Remix/design/compasses-2-line.react.svg';

export default function Component(props: { title: string; children: React.ReactNode }) {
  return (
    <div className={s.root} id={props.title}>
      <a href={`#${props.title}`} className={s.title}>
        <Compasses2LineIcon className={s.icon} />
        {props.title}
      </a>
      <div className={s.content}>
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </div>
    </div>
  );
}
