import React from 'react';
import cn from 'clsx';
import { Select as AntSelect } from 'antd';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

export interface Option<Value extends string> {
  value: Value;
  label: string;
  isDisabled?: boolean;
}

interface CommonProps<Value extends string> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  options: Option<Value>[];
}

interface SingleProps<Value extends string> extends CommonProps<Value>, InputProps<Value> {
  mode?: 'SINGLE';
}

interface MultipleProps<Value extends string> extends CommonProps<Value>, InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface TagsProps<Value extends string> extends CommonProps<Value>, InputProps<Value[]> {
  mode: 'TAGS';
}

type Props<Value extends string> = SingleProps<Value> | MultipleProps<Value> | TagsProps<Value>;

export default function Select<Value extends string = string>(props: Props<Value>) {
  const { isDisabled, options, placeholder, size = 'DEFAULT', isError, onFocus, onBlur } = props;
  const sharedProps = {
    disabled: isDisabled,
    options: options.map((option) => ({ ...option, disabled: option.isDisabled ?? false })),
    placeholder: placeholder,
    allowClear: true,
    onFocus: onFocus,
    onBlur: onBlur,
    filterOption: (inputValue: string, option?: Option<Value>) => {
      const searchString = inputValue.toLowerCase();
      return (
        option?.label.toLowerCase().includes(searchString) ||
        option?.value.toLowerCase().includes(searchString) ||
        false
      );
    },
  };

  return (
    <div className={cn(s.root, isError && s.isError, s[`size-${size}`])}>
      {props.mode === 'MULTIPLE' || props.mode === 'TAGS' ? (
        <AntSelect<string[], Option<Value>>
          {...sharedProps}
          mode={props.mode === 'MULTIPLE' ? 'multiple' : 'tags'}
          value={props.value}
          onChange={(newValue: string[]) => {
            props.onChange?.(newValue as Value[]);
          }}
        />
      ) : (
        <AntSelect<string, Option<Value>>
          {...sharedProps}
          value={props.value}
          onChange={(newValue: string) => {
            props.onChange?.(newValue as Value);
          }}
        />
      )}
    </div>
  );
}
