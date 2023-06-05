import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import SameWidthDiv from '@/components/library/SameWidthDiv';

interface Props {
  items: {
    key: string;
    icon?: React.ReactNode;
    title: string;
  }[];
  active: string;
  onChange: (key: string) => void;
  children?: React.ReactNode;
  minWidth?: number;
  additionalMenuTop?: React.ReactNode;
}

export default function VerticalMenu(props: Props) {
  const { active, items, children, minWidth, onChange } = props;
  return (
    <div className={s.root}>
      <div className={s.items} style={{ minWidth }}>
        {props.additionalMenuTop}
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(s.item, active === item.key && s.isActive)}
            onClick={() => onChange(item.key)}
          >
            {item.icon && <div className={s.icon}>{item.icon}</div>}
            <SameWidthDiv className={s.title} title={item.title}>
              {item.title}
            </SameWidthDiv>
          </div>
        ))}
      </div>
      {children && <div className={s.children}>{children}</div>}
    </div>
  );
}
