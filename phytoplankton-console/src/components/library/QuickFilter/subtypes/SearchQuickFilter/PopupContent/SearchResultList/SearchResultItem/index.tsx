import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import { ItemType } from '../../../types';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';

interface Props<T> {
  isActive: boolean;
  item: T;
  onClick: () => void;
  renderItem?: (item: T) => React.ReactNode;
}

export default function UserItem<T extends ItemType>(props: Props<T>) {
  const { isActive, item, onClick, renderItem } = props;

  return (
    <List.Item
      className={cn(s.root, isActive && s.isActive)}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
    >
      {renderItem ? renderItem(item) : <div>{item.label}</div>}
      {isActive && <CheckLineIcon className={s.activeIcon} />}
    </List.Item>
  );
}
