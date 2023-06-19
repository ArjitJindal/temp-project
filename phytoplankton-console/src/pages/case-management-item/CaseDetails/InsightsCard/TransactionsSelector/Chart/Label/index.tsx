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
  fontSize?: number;
  children: React.ReactNode;
}

export default function Label(props: Props) {
  const { className, position = {}, size = {}, fontSize, children } = props;
  return (
    <div className={cn(s.root, className)} style={{ ...position, ...size, fontSize }}>
      {children}
    </div>
  );
}
