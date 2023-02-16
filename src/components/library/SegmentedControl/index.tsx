import React from 'react';
import cn from 'clsx';
import s from './style.module.less';
import SameWidthDiv from '@/components/library/SameWidthDiv';

interface Item {
  value: string;
  label: string;
  isDisabled?: boolean;
  icon?: React.ReactNode;
}

type Props = {
  active: string;
  onChange: (newActive: string) => void;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE';
  items: Item[];
};

export default function SegmentedControl(props: Props) {
  const { active, onChange, size = 'MEDIUM', items } = props;
  return (
    <div className={cn(s.root, s[`size-${size}`])}>
      {items.map((item) => (
        <button
          key={item.value}
          className={cn(s.item, active === item.value && s.isActive)}
          disabled={item.isDisabled}
          onClick={() => {
            onChange(item.value);
          }}
        >
          {item.icon && <div className={s.itemIcon}>{item.icon}</div>}
          <SameWidthDiv>{item.label}</SameWidthDiv>
        </button>
      ))}
    </div>
  );
}
