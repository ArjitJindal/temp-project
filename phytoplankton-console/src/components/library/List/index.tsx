import React from 'react';
import { List as AntdList } from 'antd';
import cn from 'clsx';
import s from './index.module.less';
import { Option } from '@/components/library/Select';
import { Comparable, key } from '@/utils/comparable';

export interface ListProps<Value extends Comparable> {
  options: Option<Value>[];
  selectedValues?: Value[];
  onSelectOption?: (value: Value) => void;
  showCheckboxes?: boolean;
  className?: string;
  maxHeight?: string;
  testId?: string;
}

export default function List<Value extends Comparable = string>(props: ListProps<Value>) {
  const {
    options,
    selectedValues = [],
    onSelectOption,
    showCheckboxes = false,
    className,
    maxHeight = '60vh',
    testId,
  } = props;

  const handleItemClick = (option: Option<Value>, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (option.isDisabled) {
      return;
    }

    onSelectOption?.(option.value);
  };

  return (
    <AntdList<Option<Value>>
      className={cn(s.list, className)}
      dataSource={options}
      style={{ maxHeight, overflowY: 'auto' }}
      data-cy={testId}
      renderItem={(option: Option<Value>) => (
        <AntdList.Item
          key={key(option.value)}
          className={cn(
            s.item,
            selectedValues.includes(option.value) && s.isActive,
            option.isDisabled && s.isDisabled,
          )}
          onClick={(e) => handleItemClick(option, e)}
          data-cy={option.value}
        >
          <AntdList.Item.Meta title={option.label} />
          {showCheckboxes && (
            <div className={s.checkboxContainer}>
              {selectedValues.includes(option.value) && <div className={s.checkIcon}>✓</div>}
            </div>
          )}
        </AntdList.Item>
      )}
    />
  );
}
