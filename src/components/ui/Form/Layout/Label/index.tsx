import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  icon?: React.ReactNode;
  title: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'bold';
  children?: React.ReactNode;
}

export default function Label(props: Props) {
  const { icon, title, variant = 'default', orientation = 'vertical', children } = props;
  return (
    <div className={cn(s.root, s[variant], s[`orientation-${orientation}`])}>
      <div className={s.header}>
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={s.title}>{title}</div>
      </div>
      {children}
    </div>
  );
}
