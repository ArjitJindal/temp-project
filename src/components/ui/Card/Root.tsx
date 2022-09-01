import React from 'react';
import cn from 'clsx';
import s from './index.module.less';
import Column from './Column';

interface Props {
  className?: string;
  children: React.ReactNode;
}

export default function Root(props: Props) {
  return (
    <div className={cn(s.root, props.className)}>
      <Column>{props.children}</Column>
    </div>
  );
}
