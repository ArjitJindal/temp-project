import React from 'react';
import { List } from 'antd';
import cn from 'clsx';
import QuickFilterBase from '../../QuickFilterBase';
import s from './index.module.less';
import { InputProps } from '@/components/library/Form';
import { Props as QuickFilterProps } from '@/components/library/QuickFilter/QuickFilterBase';
import { InputType, Option } from '@/components/library/Select';
import { joinReactNodes } from '@/utils/react';

interface SharedProps<Value extends InputType> extends QuickFilterProps {
  options: Option<Value>[];
}

interface MultipleProps<Value extends InputType> extends SharedProps<Value>, InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface SingleProps<Value extends InputType> extends SharedProps<Value>, InputProps<Value> {
  mode: 'SINGLE';
}

type Props<Value extends InputType> = MultipleProps<Value> | SingleProps<Value>;

export default function ListQuickFilter<Value extends InputType>(props: Props<Value>) {
  const { options, onChange = () => {}, ...rest } = props;

  const valueArray: Value[] = props.value
    ? props.mode === 'SINGLE'
      ? [props.value]
      : props.value
    : [];
  const isEmpty = valueArray.length === 0;

  const buttonText = isEmpty
    ? undefined
    : joinReactNodes(
        options.filter((option) => valueArray.includes(option.value)).map(({ label }) => label),
      );

  return (
    <QuickFilterBase
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
              className={cn(s.item, valueArray.includes(option.value) && s.isActive)}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (props.mode === 'SINGLE') {
                  props.onChange?.(option.value);
                  setOpen(false);
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
