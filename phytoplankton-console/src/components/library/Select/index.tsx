import { Select as AntSelect } from 'antd';
import cn from 'clsx';
import { uniq } from 'lodash';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import s from './style.module.less';
import { parseSearchString, filterOption, SEPARATOR } from './helpers';
import { InputProps } from '@/components/library/Form';
import { message } from '@/components/library/Message';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { copyTextToClipboard } from '@/utils/browser';
import { Comparable, key } from '@/utils/comparable';
import { neverReturn } from '@/utils/lang';

export interface Option<Value extends Comparable> {
  value: Value;
  label?: React.ReactNode;
  labelText?: string;
  alternativeLabels?: string[]; // Used for search
  isDisabled?: boolean;
  isDefault?: boolean;
}

interface CommonProps<Value extends Comparable> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  options: Option<Value>[];
  style?: React.CSSProperties;
  dropdownPlacement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  allowClear?: boolean;
  notFoundContent?: React.ReactNode;
  className?: string;
  innerRef?: React.RefObject<any>;
  isCopyable?: boolean;
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

export type Props<Value extends Comparable> =
  | SingleProps<Value>
  | MultipleProps<Value>
  | TagsProps<Value>;

export default function Select<Value extends Comparable = string>(props: Props<Value>) {
  const {
    isDisabled,
    options,
    placeholder,
    size = 'DEFAULT',
    isError,
    isLoading,
    className,
    innerRef,
    isCopyable,
    value,
    onChange,
    allowClear = true,
  } = props;

  const selectInput = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');

  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const applySearchStringValue = useCallback(
    (searchString: string, skipUnknown: boolean) => {
      const parsedValues = parseSearchString(options, searchString, skipUnknown);
      let newValue;
      if (props.mode === 'MULTIPLE' || props.mode === 'TAGS') {
        newValue = uniq([...(props.value ?? []), ...parsedValues] as Value[]);
      } else if (props.mode === 'SINGLE' || props.mode == null) {
        newValue = parsedValues[0] ?? props.value;
      } else {
        newValue = neverReturn(props.mode, props.value);
      }
      onChange?.(newValue as (Value & Value[]) | undefined);
      setSearchValue('');
    },
    [props.value, props.mode, options, onChange],
  );

  const filteredOptions = useMemo(
    () => options.filter((option) => filterOption(searchValue, option)),
    [searchValue, options],
  );

  const handleCopyText = useCallback(() => {
    if (props.value) {
      const valueToCopy = Array.isArray(props.value)
        ? props.value.join(',')
        : props.value.toString();
      if (valueToCopy && valueToCopy.length > 0) {
        valueToCopy && copyTextToClipboard(valueToCopy);
        message.success('Copied');
      }
    }
  }, [props.value]);

  useEffect(() => {
    if (isFocused) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
          handleCopyText();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isFocused, handleCopyText]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };
  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      className={cn(
        s.root,
        isError && s.isError,
        s[`size-${size}`],
        (props.mode === 'MULTIPLE' || props.mode === 'TAGS') && s.extraPadding,
        className,
      )}
      style={props.style}
      ref={selectInput}
    >
      <AntSelect
        ref={innerRef}
        placeholder={placeholder}
        allowClear={allowClear}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          applySearchStringValue(searchValue, props.mode !== 'TAGS');
          setSearchValue('');
        }}
        filterOption={() => true}
        showSearch={true}
        notFoundContent={props.notFoundContent}
        placement={props.dropdownPlacement}
        mode={props.mode === 'MULTIPLE' ? 'multiple' : props.mode === 'TAGS' ? 'tags' : undefined}
        value={value}
        onChange={(newValue: Value | Value[] | undefined) => {
          props.onChange?.(newValue as (Value & Value[]) | undefined);
          setSearchValue('');
        }}
        onSearch={(searchString) => {
          setSearchValue(searchString);
          if (searchString.includes(SEPARATOR)) {
            applySearchStringValue(searchString, props.mode !== 'TAGS');
          }
        }}
        defaultValue={filteredOptions
          .filter((option) => option.isDefault)
          .map((option) => option.value)}
        loading={isLoading}
        disabled={isDisabled || isLoading}
        dropdownMatchSelectWidth={
          selectInput.current ? selectInput.current?.getBoundingClientRect().width : true
        }
        suffixIcon={
          isCopyable &&
          Array.isArray(props.value) &&
          props.value.length > 0 && (
            <FileCopyLineIcon
              onClick={handleCopyText}
              className={cn(s.copyIcon, isHovered && s.isVisible)}
            />
          )
        }
        showArrow={true}
        searchValue={searchValue}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {filteredOptions?.map((option) => (
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
