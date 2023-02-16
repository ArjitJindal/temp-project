import React from 'react';
import cn from 'clsx';
import { Select as AntSelect, SelectProps } from 'antd';
import { SelectCommonPlacement } from 'antd/lib/_util/motion';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

type InputType = string | number | boolean | undefined;

export interface Option<Value extends InputType> {
  value: Value;
  label?: string;
  isDisabled?: boolean;
}

interface CommonProps<Value extends InputType> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  options: Option<Value>[];
  style?: React.CSSProperties;
  showSearch?: boolean;
  dropdownPlacement?: SelectCommonPlacement;
}

interface SingleProps<Value extends InputType> extends CommonProps<Value>, InputProps<Value> {
  mode?: 'SINGLE';
}

interface MultipleProps<Value extends InputType> extends CommonProps<Value>, InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface TagsProps<Value extends InputType> extends CommonProps<Value>, InputProps<Value[]> {
  mode: 'TAGS';
}

type Props<Value extends InputType> = SingleProps<Value> | MultipleProps<Value> | TagsProps<Value>;

export default function Select<Value extends InputType = InputType>(props: Props<Value>) {
  const { isDisabled, options, placeholder, size = 'DEFAULT', isError, onFocus, onBlur } = props;

  const antSelectProps: SelectProps<Value | Value[], Option<Value>> = {
    disabled: isDisabled,
    placeholder: placeholder,
    allowClear: true,
    onFocus: onFocus,
    onBlur: onBlur,
    filterOption: (inputValue: string, option?: Option<Value>) => {
      const searchString = inputValue.toLowerCase();
      return (
        (option?.label?.toLowerCase().includes(searchString) ||
          option?.value?.toString().toLowerCase().includes(searchString)) ??
        false
      );
    },
    showSearch: props.showSearch,
    placement: props.dropdownPlacement,
    mode: props.mode === 'MULTIPLE' ? 'multiple' : props.mode === 'TAGS' ? 'tags' : undefined,
    value: props.value,
    onChange: (newValue: Value | Value[] | undefined) => {
      props.onChange?.(newValue as (Value & Value[]) | undefined);
    },
  };

  return (
    <div className={cn(s.root, isError && s.isError, s[`size-${size}`])} style={props.style}>
      <AntSelect {...antSelectProps}>
        {options?.map((option) => (
          <AntSelect.Option
            key={`${option.value}`}
            value={option.value}
            disabled={option.isDisabled}
          >
            {option.label}
          </AntSelect.Option>
        ))}
      </AntSelect>
    </div>
  );
}
