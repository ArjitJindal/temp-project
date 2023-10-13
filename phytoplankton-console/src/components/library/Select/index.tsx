import React, { useRef } from 'react';
import cn from 'clsx';
import { Select as AntSelect, SelectProps } from 'antd';
import { SelectCommonPlacement } from 'antd/lib/_util/motion';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import { Comparable, key } from '@/utils/comparable';

export interface Option<Value extends Comparable> {
  value: Value;
  label?: React.ReactNode;
  isDisabled?: boolean;
  isDefault?: boolean;
}

interface CommonProps<Value extends Comparable> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  options: Option<Value>[];
  style?: React.CSSProperties;
  dropdownPlacement?: SelectCommonPlacement;
  allowClear?: boolean;
  notFoundContent?: React.ReactNode;
  className?: string;
}

export interface SingleProps<Value extends Comparable>
  extends CommonProps<Value>,
    InputProps<Value> {
  mode?: 'SINGLE';
}

export interface MultipleProps<Value extends Comparable>
  extends CommonProps<Value>,
    InputProps<Value[]> {
  mode: 'MULTIPLE';
}

interface TagsProps<Value extends Comparable> extends CommonProps<Value>, InputProps<Value[]> {
  mode: 'TAGS';
}

type Props<Value extends Comparable> = SingleProps<Value> | MultipleProps<Value> | TagsProps<Value>;

export default function Select<Value extends Comparable = string>(props: Props<Value>) {
  const {
    isDisabled,
    options,
    placeholder,
    size = 'DEFAULT',
    isError,
    isLoading,
    onFocus,
    onBlur,
    className,
  } = props;

  const selectInput = useRef<HTMLDivElement | null>(null);

  const antSelectProps: SelectProps<Value | Value[], Option<Value>> = {
    disabled: isDisabled,
    placeholder: placeholder,
    allowClear: props.allowClear,
    onFocus: onFocus,
    onBlur: onBlur,
    filterOption: (inputValue: string, option?: Option<Value>) => {
      const searchString = inputValue.toLowerCase();
      return (
        (option?.label?.toString().toLowerCase().includes(searchString) ||
          option?.value?.toString().toLowerCase().includes(searchString) ||
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          option?.children?.toString().toLowerCase().includes(searchString)) ??
        false
      );
    },
    showSearch: true,
    notFoundContent: props.notFoundContent,
    placement: props.dropdownPlacement,
    mode: props.mode === 'MULTIPLE' ? 'multiple' : props.mode === 'TAGS' ? 'tags' : undefined,
    value: props.value,
    onChange: (newValue: Value | Value[] | undefined) => {
      props.onChange?.(newValue as (Value & Value[]) | undefined);
    },
    onSearch: props.onSearch,
    defaultValue: options.filter((option) => option.isDefault).map((option) => option.value),
  };

  return (
    <div
      className={cn(s.root, isError && s.isError, s[`size-${size}`], className)}
      style={props.style}
      ref={selectInput}
    >
      <AntSelect
        {...antSelectProps}
        allowClear
        loading={isLoading}
        disabled={isDisabled || isLoading}
        dropdownMatchSelectWidth={
          selectInput.current ? selectInput.current?.getBoundingClientRect().width : true
        }
      >
        {options?.map((option) => (
          <AntSelect.Option
            key={key(option.value)}
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
