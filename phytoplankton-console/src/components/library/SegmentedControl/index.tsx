import React from 'react';
import cn from 'clsx';
import { kebabCase } from 'lodash';
import s from './style.module.less';
import SameWidthDiv from '@/components/library/SameWidthDiv';
import { Comparable, compare, key } from '@/utils/comparable';

export interface Item<Value> {
  value: Value;
  label?: string;
  isDisabled?: boolean;
  icon?: React.ReactNode;
}

interface Props<Value extends Comparable> {
  active: Value;
  onChange: (newActive: Value) => void;
  size?: 'SMALL' | 'MEDIUM' | 'LARGE';
  items: Item<Value>[];
  style?: React.CSSProperties;
}

export default function SegmentedControl<Value extends Comparable = string>(props: Props<Value>) {
  const { active, onChange, size = 'MEDIUM', items, style } = props;
  return (
    <div className={cn(s.root, s[`size-${size}`])} style={style} data-cy={'segmented-control'}>
      {items.map((item) => (
        <button
          key={key(item.value)}
          type="button"
          className={cn(s.item, { [s.isActive]: compare(active, item.value) })}
          disabled={item.isDisabled}
          onClick={() => {
            onChange(item.value);
          }}
          data-cy={`segmented-control-${kebabCase(item.value?.toString())}`}
        >
          {item.icon && <div className={s.itemIcon}>{item.icon}</div>}
          {item.label && <SameWidthDiv>{item.label}</SameWidthDiv>}
        </button>
      ))}
    </div>
  );
}
