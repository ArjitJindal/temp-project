import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  icon?: React.ReactNode;
  title: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'bold';
  color?: 'default' | 'dark';
  children?: React.ReactNode;
  className?: string;
}

export default function Label(props: Props) {
  const {
    icon,
    title,
    variant = 'default',
    orientation = 'vertical',
    color = 'default',
    children,
    className = '',
  } = props;
  return (
    <div className={cn(s.root, s[variant], s[`orientation-${orientation}`], className)}>
      <div className={s.header}>
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={cn(s.title, s[color])}>{title}</div>
      </div>
      {children}
    </div>
  );
}
