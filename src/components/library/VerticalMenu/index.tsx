import React from 'react';
import cn from 'clsx';
import s from './style.module.less';

interface Props {
  items: {
    key: string;
    title: string;
  }[];
  active: string;
  onChange: (key: string) => void;
  children?: React.ReactNode;
}

export default function VerticalMenu(props: Props) {
  const { active, items, children, onChange } = props;
  return (
    <div className={s.root}>
      <div className={s.items}>
        {items.map((item) => (
          <div
            key={item.key}
            title={item.title}
            className={cn(s.item, active === item.key && s.isActive)}
            onClick={() => onChange(item.key)}
          >
            {item.title}
          </div>
        ))}
      </div>
      {children && <div className={s.children}>{children}</div>}
    </div>
  );
}
