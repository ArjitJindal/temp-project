import React from 'react';
import cn from 'clsx';
import s from './index.module.less';

interface Props {
  icon?: React.ReactNode;
  title?: string;
  className?: string;
}

export default function Subtitle(props: Props) {
  const { className, icon, title } = props;
  return (
    <div className={cn(s.subtitle, className)}>
      <div className={s.item}>
        {icon && <div className={s.icon}>{icon}</div>}
        <div className={s.name}>{title}</div>
      </div>
    </div>
  );
}
