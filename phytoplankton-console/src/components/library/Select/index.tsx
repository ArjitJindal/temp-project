import React, { useRef, useCallback, useEffect, useState } from 'react';
import cn from 'clsx';
import { Select as AntSelect, SelectProps } from 'antd';
import { SelectCommonPlacement } from 'antd/lib/_util/motion';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import { Comparable, key } from '@/utils/comparable';
import { copyTextToClipboard } from '@/utils/browser';
import { message } from '@/components/library/Message';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';

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
    className,
  } = props;

  const selectInput = useRef<HTMLDivElement | null>(null);

  const [presentValue, setpresentValue] = useState<Value | Value[] | undefined>(props.value);
  const [isFocused, setisFocused] = useState<boolean>(false);
  const [isHovered, setisHovered] = useState<boolean>(false);

  const antSelectProps: SelectProps<Value | Value[], Option<Value>> = {
    disabled: isDisabled,
    placeholder: placeholder,
    allowClear: props.allowClear,
    onFocus: () => setisFocused(true),
    onBlur: () => setisFocused(false),
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
      setpresentValue(newValue);
    },
    onSearch: props.onSearch,
    defaultValue: options.filter((option) => option.isDefault).map((option) => option.value),
    tokenSeparators: [','],
  };

  const copyText = useCallback(() => {
    if (presentValue) {
      const valueToCopy = Array.isArray(presentValue)
        ? presentValue.join(',')
        : presentValue.toString();
      if (valueToCopy && valueToCopy.length > 0) {
        valueToCopy && copyTextToClipboard(valueToCopy);
        message.success('Copied');
      }
    }
  }, [presentValue]);

  useEffect(() => {
    if (isFocused === true) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
          copyText();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [presentValue, isFocused, copyText]);

  const handleMouseEnter = () => {
    if (antSelectProps.mode !== undefined) {
      if (Array.isArray(presentValue)) {
        if (presentValue.length > 0) setisHovered(true);
      } else {
        if (presentValue) setisHovered(true);
      }
    }
  };
  const handleMouseLeave = () => {
    if (antSelectProps.mode !== undefined) {
      setisHovered(false);
    }
  };

  return (
    <div
      className={cn(
        s.root,
        isError && s.isError,
        s[`size-${size}`],
        isHovered && s.ishovered,
        className,
      )}
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
        suffixIcon={
          antSelectProps.mode !== undefined && (
            <div onClick={copyText}>
              <FileCopyLineIcon className={cn(s.copyIcon)} />
            </div>
          )
        }
        showArrow={true}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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
