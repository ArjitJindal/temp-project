import { Select as AntSelect } from 'antd';
import cn from 'clsx';
import { uniq, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Tooltip from '../Tooltip';
import s from './style.module.less';
import { parseSearchString, filterOption, SEPARATOR } from './helpers';
import { InputProps } from '@/components/library/Form';
import { message } from '@/components/library/Message';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { copyTextToClipboard } from '@/utils/browser';
import { Comparable, key } from '@/utils/comparable';
import { getErrorMessage, neverReturn } from '@/utils/lang';

export interface Option<Value extends Comparable> {
  value: Value;
  label?: React.ReactNode;
  fullLabel?: React.ReactNode;
  labelText?: string;
  alternativeLabels?: string[]; // Used for search
  isDisabled?: boolean;
  isDefault?: boolean;
  isVirtual?: boolean;
}

interface CommonProps<Value extends Comparable> {
  placeholder?: string | React.ReactNode;
  size?: 'DEFAULT' | 'LARGE';
  options: Option<Value>[];
  style?: React.CSSProperties;
  dropdownPlacement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  allowClear?: boolean;
  notFoundContent?: React.ReactNode;
  className?: string;
  innerRef?: React.RefObject<any>;
  isCopyable?: boolean;
  isSearchable?: boolean;
  portaled?: boolean;
  dropdownMatchWidth?: boolean;
  autoTrim?: boolean;
  testId?: string;
  optionLabelProp?: string;
  tooltip?: boolean;
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

export interface TagsProps<Value extends Comparable>
  extends CommonProps<Value>,
    InputProps<Value[]> {
  mode: 'TAGS';
}

/**
 * DYNAMIC mode is used to add new options to the dropdown when the user is typing.
 * In this mode:
 * - Users can type and select values that don't exist in the initial options
 * - New options are automatically added to the dropdown list
 * - The component maintains its own internal state of options
 * - New options persist in the dropdown until the component is unmounted
 */

export interface DynamicProps<Value extends Comparable>
  extends CommonProps<Value>,
    InputProps<Value> {
  mode: 'DYNAMIC';
}

export type Props<Value extends Comparable> =
  | SingleProps<Value>
  | MultipleProps<Value>
  | TagsProps<Value>
  | DynamicProps<Value>;

export default function Select<Value extends Comparable = string>(props: Props<Value>) {
  const {
    mode = 'SINGLE',
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
    allowClear = true,
    portaled = false,
    dropdownMatchWidth = true,
    autoTrim = false,
    testId = `input select`,
    optionLabelProp,
    tooltip,
    onSearch,
    isSearchable = true,
  } = props;

  const selectInput = useRef<HTMLDivElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [internalOptions, setInternalOptions] = useState<Option<Value>[]>(options);

  useEffect(() => {
    setInternalOptions((prevOptions) => {
      const existingVirtualOptions = prevOptions.filter((opt) => opt.isVirtual);
      const newOptions = [...options, ...existingVirtualOptions];
      return uniqBy(newOptions, 'value');
    });
  }, [options]);

  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const handleChange = useCallback(
    (newValue: Value | Value[] | undefined) => {
      if (props.mode === 'MULTIPLE' || props.mode === 'TAGS') {
        if (Array.isArray(newValue)) {
          props.onChange?.(newValue.length === 0 ? [] : newValue);
        }
      } else if (props.mode === 'SINGLE' || props.mode === 'DYNAMIC' || props.mode == null) {
        if (!Array.isArray(newValue)) {
          props.onChange?.(newValue);
        }
      } else {
        neverReturn(props.mode, null);
      }
      setSearchValue('');
    },
    [props],
  );

  const addNewOption = useCallback(
    (newValue: string) => {
      if (!newValue?.trim()) {
        return false;
      }

      const trimmedValue = newValue.trim();
      const valueStr = trimmedValue.toLowerCase();

      const optionExists = internalOptions.some((option) => {
        const optionValue = option.value?.toString().trim()?.toLowerCase();
        return optionValue === valueStr && (!option.isVirtual || option.label === trimmedValue);
      });

      if (optionExists) {
        return false;
      }

      const newOption: Option<Value> = {
        value: trimmedValue.toString() as Value,
        label: trimmedValue,
        labelText: trimmedValue,
        isVirtual: true,
      };

      setInternalOptions((prev) => uniqBy([...prev, newOption], 'value'));

      if (props.mode === 'DYNAMIC') {
        handleChange(trimmedValue as Value);
      }

      return true;
    },
    [internalOptions, handleChange, props],
  );

  const applySearchStringValue = useCallback(
    (searchString: string, skipUnknown: boolean) => {
      const parsedValues = parseSearchString(internalOptions, searchString, skipUnknown);
      let newValue;
      if (props.mode === 'MULTIPLE' || props.mode === 'TAGS') {
        newValue = uniq([...(props.value ?? []), ...parsedValues] as Value[]);
      } else if (props.mode === 'SINGLE' || props.mode === 'DYNAMIC' || props.mode == null) {
        newValue = parsedValues[0] ?? props.value;
      } else {
        newValue = neverReturn(props.mode, props.value);
      }
      handleChange?.(newValue as (Value & Value[]) | undefined);
      setSearchValue('');
    },
    [props.value, props.mode, internalOptions, handleChange],
  );

  const filteredOptions = useMemo(() => {
    let options = searchValue
      ? internalOptions
          .filter((option) => filterOption(searchValue, option))
          .sort((option1, option2) => {
            // Shorter options are more relevant
            return (
              (option1.value?.toString() ?? '').length - (option2.value?.toString() ?? '').length
            );
          })
      : internalOptions;

    // For DYNAMIC mode, add the search term as an option if it doesn't exist already
    if (props.mode === 'DYNAMIC' && searchValue && searchValue.trim() !== '') {
      const searchValueLower = searchValue.toLowerCase();
      const exactMatchExists = options.some(
        (option) => option.value?.toString().toLowerCase() === searchValueLower,
      );

      if (!exactMatchExists) {
        // Add search term as a "virtual" option in the dropdown
        options = [
          ...options,
          {
            value: searchValue as unknown as Value,
            label: searchValue,
            labelText: searchValue,
            // We'll use this flag to identify dynamically added options that aren't saved yet
            isVirtual: true,
          },
        ];
      }
    }

    return options;
  }, [searchValue, internalOptions, props.mode]);

  const handleCopyText = useCallback(async () => {
    if (props.value) {
      const valueToCopy = Array.isArray(props.value)
        ? props.value.join(SEPARATOR)
        : props.value.toString();
      if (valueToCopy && valueToCopy.length > 0) {
        try {
          await copyTextToClipboard(valueToCopy);
          message.success('Copied');
        } catch (error) {
          message.error(`Failed to copy: ${getErrorMessage(error)}`);
        }
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

  let dropdownMatchSelectWidth;
  if (!dropdownMatchWidth) {
    dropdownMatchSelectWidth = false;
  } else {
    dropdownMatchSelectWidth = selectInput.current
      ? selectInput.current?.getBoundingClientRect().width
      : true;
  }

  const toolTipText = useMemo(() => {
    let text = '';

    if (!tooltip) {
      return text;
    }

    if (props.mode === 'MULTIPLE' || props.mode === 'TAGS') {
      const filteredOptions = internalOptions.filter((option) =>
        props.value?.includes(option.value),
      );
      text = filteredOptions
        .map(
          (option) =>
            option.labelText ??
            (['string', 'number', 'boolean'].includes(typeof option.label)
              ? option.label?.toString()
              : option.value?.toString()) ??
            '',
        )
        .join(', ');
    } else if (props.mode === 'SINGLE' || props.mode === 'DYNAMIC' || props.mode == null) {
      const option = internalOptions.find((option) => option.value === props.value);
      text =
        option?.labelText ??
        (['string', 'number', 'boolean'].includes(typeof option?.label)
          ? option?.label?.toString()
          : props.value?.toString()) ??
        '';
    }

    return text;
  }, [internalOptions, props.mode, props.value, tooltip]);

  // For DYNAMIC mode, we don't need custom not found content
  // because we'll show the search term as an option directly in the dropdown

  const antSelect: JSX.Element = (
    <div
      className={cn(
        s.root,
        isError && s.isError,
        autoTrim && s.autoTrim,
        s[`size-${size}`],
        s[`mode-${mode ?? 'SINGLE'}`],
        (mode === 'MULTIPLE' || mode === 'TAGS') && s.extraPadding,
        className,
      )}
      style={props.style}
      ref={selectInput}
      data-cy={testId}
    >
      <AntSelect
        getPopupContainer={
          portaled
            ? () => {
                return document.body;
              }
            : undefined
        }
        ref={innerRef}
        placeholder={placeholder}
        allowClear={allowClear}
        optionLabelProp={optionLabelProp}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          if (searchValue != '') {
            if (props.mode === 'DYNAMIC') {
              // Add new option on blur for DYNAMIC mode if it doesn't exist yet
              addNewOption(searchValue.trim());
            } else {
              applySearchStringValue(searchValue.trim(), mode !== 'TAGS');
            }
            setSearchValue('');
          }
        }}
        filterOption={() => true}
        showSearch={isSearchable}
        notFoundContent={props.notFoundContent}
        placement={props.dropdownPlacement ?? 'bottomLeft'}
        mode={mode === 'MULTIPLE' ? 'multiple' : mode === 'TAGS' ? 'tags' : undefined}
        value={value}
        onChange={(newValue) => {
          // For DYNAMIC mode, check if the selected option is a virtual one
          if (props.mode === 'DYNAMIC' && newValue) {
            const selectedOption = filteredOptions.find((option) => option.value === newValue);
            if (selectedOption?.isVirtual) {
              // Add the option permanently to our internal options
              addNewOption(newValue.toString());
              return; // addNewOption already calls handleChange
            }
          }
          handleChange(newValue);
        }}
        onSearch={(searchString) => {
          onSearch?.(searchString);
          setSearchValue(searchString);
          if (searchString.includes(SEPARATOR)) {
            applySearchStringValue(searchString, mode !== 'TAGS');
          }
        }}
        defaultValue={filteredOptions
          .filter((option) => option.isDefault)
          .map((option) => option.value)}
        loading={isLoading}
        disabled={isDisabled || isLoading}
        dropdownMatchSelectWidth={dropdownMatchSelectWidth}
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
            {...(option.labelText && { [optionLabelProp ?? 'labelText']: option.labelText })}
            {...(tooltip && { title: '' })}
          >
            {option.label}
          </AntSelect.Option>
        ))}
      </AntSelect>
    </div>
  );

  return tooltip ? (
    <Tooltip title={toolTipText} placement="top">
      {antSelect}
    </Tooltip>
  ) : (
    antSelect
  );
}
