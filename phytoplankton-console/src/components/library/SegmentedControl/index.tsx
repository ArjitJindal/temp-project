import React from 'react';
import cn from 'clsx';
import _ from 'lodash';
import s from './style.module.less';
import SameWidthDiv from '@/components/library/SameWidthDiv';
import { Comparable, compare, key } from '@/utils/comparable';

export interface Item<Value> {
  value: Value;
  label: string;
  isDisabled?: boolean;
  icon?: React.ReactNode;
}

interface Props<Value extends Comparable> {
  active: Value;
  onChange: (newActive: Value) => void;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE';
  items: Item<Value>[];
}

export default function SegmentedControl<Value extends Comparable = string>(props: Props<Value>) {
  const { active, onChange, size = 'MEDIUM', items } = props;
  return (
    <div className={cn(s.root, s[`size-${size}`])}>
      {items.map((item) => (
        <button
          key={key(item.value)}
          className={cn(s.item, { [s.isActive]: compare(active, item.value) })}
          disabled={item.isDisabled}
          onClick={() => {
            onChange(item.value);
          }}
          data-cy={`segmented-control-${_.kebabCase(item.value?.toString())}`}
        >
          {item.icon && <div className={s.itemIcon}>{item.icon}</div>}
          <SameWidthDiv>{item.label}</SameWidthDiv>
        </button>
      ))}
    </div>
  );
}
