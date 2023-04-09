import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import { paymethodOptions } from '@/utils/tags';

interface Props {
  value: string[];
  onConfirm: (status: string[]) => void;
}

export default function PopupContent(props: Props) {
  const { value, onConfirm } = props;
  return (
    <div className={s.root}>
      <List
        dataSource={paymethodOptions}
        renderItem={(item) => (
          <List.Item
            className={cn(s.item, value.includes(item.value) && s.isActive)}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onConfirm(
                !value.includes(item.value)
                  ? [...value, item.value]
                  : value.filter((x) => x !== item.value),
              );
            }}
          >
            <List.Item.Meta title={item.label} />
          </List.Item>
        )}
      />
    </div>
  );
}
