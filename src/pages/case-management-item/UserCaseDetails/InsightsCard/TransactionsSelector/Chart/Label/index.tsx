import React from 'react';
import cn from 'clsx';
import s from './styles.module.less';

interface Props {
  className?: string;
  size?: {
    width?: number;
    height?: number;
  };
  position?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  children: string;
}

export default function Label(props: Props) {
  const { className, position = {}, size = {}, children } = props;
  return (
    <div className={cn(s.root, className)} style={{ ...position, ...size }}>
      {children}
    </div>
  );
}
