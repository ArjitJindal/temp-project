import React from 'react';
import cn from 'clsx';
import s from './style.module.less';

interface Props extends React.HTMLAttributes<unknown> {
  title?: string;
  children: React.ReactNode;
}

export default function SameWidthDiv(props: Props) {
  const { children, className, title, ...rest } = props;
  return (
    <div
      {...rest}
      className={cn(s.root, className)}
      title={title ?? (typeof children === 'string' ? children : '')}
    >
      {children}
    </div>
  );
}
