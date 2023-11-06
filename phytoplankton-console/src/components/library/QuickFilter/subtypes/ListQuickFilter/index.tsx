import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import QuickFilterBase from '../../QuickFilterBase';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { Props as QuickFilterProps } from '@/components/library/QuickFilter/QuickFilterBase';
import { Option } from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';
import { Comparable, key } from '@/utils/comparable';

interface SharedProps<Value extends Comparable> extends QuickFilterProps {
  options: Option<Value>[];
  onUpdateFilterClose?: (status: boolean) => void;
}

interface MultipleProps<Value extends Comparable> extends SharedProps<Value>, InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface SingleProps<Value extends Comparable> extends SharedProps<Value>, InputProps<Value> {
  mode: 'SINGLE';
}

type Props<Value extends Comparable> = MultipleProps<Value> | SingleProps<Value>;

export default function ListQuickFilter<Value extends Comparable>(props: Props<Value>) {
  const { options, onChange = () => {}, onUpdateFilterClose, ...rest } = props;

  const valueArray: Value[] = props.value
    ? props.mode === 'SINGLE'
      ? [props.value]
      : props.value
    : [];
  const isEmpty = valueArray.length === 0;

  const buttonText = isEmpty
    ? undefined
    : joinReactNodes(
        options
          .filter((option) => valueArray.includes(option.value))
          .map(({ label, labelText }) => labelText ?? label),
      );

  return (
    <QuickFilterBase
      onUpdateFilterClose={onUpdateFilterClose}
      {...rest}
      buttonText={buttonText}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onChange(undefined);
            }
      }
    >
      {({ setOpen }) => (
        <List<Option<Value>>
          className={s.list}
          dataSource={options}
          renderItem={(option: Option<Value>) => (
            <List.Item
              key={key(option.value)}
              className={cn(s.item, valueArray.includes(option.value) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (props.mode === 'SINGLE') {
                  props.onChange?.(option.value);
                  setOpen(false);
                  onUpdateFilterClose && onUpdateFilterClose(true);
                } else {
                  props.onChange?.(
                    !valueArray.includes(option.value)
                      ? [...(valueArray ?? []), option.value]
                      : valueArray.filter((x) => x !== option.value),
                  );
                }
              }}
            >
              <List.Item.Meta title={option.label} />
            </List.Item>
          )}
        />
      )}
    </QuickFilterBase>
  );
}
