import React from 'react';
import cn from 'clsx';
import s from './style.module.less';

interface Props extends React.HTMLAttributes<unknown> {
  children: string;
}

export default function SameWidthDiv(props: Props) {
  const { children, className, ...rest } = props;
  return (
    <div {...rest} className={cn(s.root, className)} title={children}>
      {children}
    </div>
  );
}
