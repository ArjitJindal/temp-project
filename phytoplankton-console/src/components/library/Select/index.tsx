import cn from 'clsx';
import React, { ReactSVGElement, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  size as floatingUiSize,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { uniq } from 'lodash';
import Tag from '../Tag';
import s from './style.module.less';
import SelectMenu from './SelectMenu';
import { filterOption, parseSearchString, SEPARATOR } from './helpers';
import { useId } from '@/utils/hooks';
import { InputProps } from '@/components/library/Form';
import { Comparable, compare, key } from '@/utils/comparable';
import { getErrorMessage, isEqual } from '@/utils/lang';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import ArrowDownIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import LoaderIcon from '@/components/ui/icons/Remix/system/loader-4-line.react.svg';
import FileCopyLineIcon from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { copyTextToClipboard } from '@/utils/browser';
import { message } from '@/components/library/Message';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

export interface Option<Value extends Comparable> {
  value: Value;
  label?: React.ReactNode;
  fullLabel?: React.ReactNode;
  labelText?: string;
  alternativeLabels?: string[]; // Used for search
  isDisabled?: boolean;
  isDefault?: boolean;
  isVirtual?: boolean;
  icon?: React.ReactNode;
}

interface CommonProps {
  size?: 'DEFAULT' | 'LARGE';
  allowClear?: boolean;
  isCopyable?: boolean;
  notFoundContent?: React.ReactNode;
  isLoading?: boolean;
  testId?: string;
  hiddenDropdown?: boolean;
  fixedHeight?: boolean;
  placeholder?: string;
  placeholderIcon?: React.ReactNode;
  hideBorders?: boolean;
  width?: string | number;
  rootRef?: (node: HTMLElement | null) => void;
}

export interface SingleProps<Value extends Comparable> extends CommonProps, InputProps<Value> {
  mode?: 'SINGLE';
  options: Option<Value>[];
}

export interface MultipleProps<Value extends Comparable> extends CommonProps, InputProps<Value[]> {
  mode: 'MULTIPLE';
  options: Option<Value>[];
  allowNewOptions?: boolean;
}

/**
 * Dynamic mode inteded for use-cases when we want to allow users to input values that are not in the initial options.
 */
export interface DynamicProps extends CommonProps, InputProps<string> {
  mode: 'DYNAMIC';
  options: Option<string>[];
  keepUnusedOptionsAvailable?: boolean;
}

export type Props<Value extends Comparable> =
  | SingleProps<Value>
  | MultipleProps<Value>
  | DynamicProps;

const VIEWPORT_PADDING = 8;
const MIN_HEIGHT = 100;
const MIN_WIDTH = 200;
const MAX_WIDTH = 800;

export default function Select<Value extends Comparable = string>(props: Props<Value>) {
  const {
    options,
    mode,
    value,
    onChange,
    isCopyable = false,
    isLoading = false,
    isDisabled = false,
    isError = false,
    allowClear = true,
    placeholderIcon,
    placeholder,
    size = 'DEFAULT',
    hiddenDropdown = false,
    fixedHeight = false,
    hideBorders = false,
    width,
  } = props;

  const id = useId(`select-`);

  const [searchText, setSearchText] = useState<string | undefined>(undefined);

  const [virtualOptions, setVirtualOptions] = useState<Option<Value>[]>([]);

  const keepUnusedOptionsAvailable =
    props.mode === 'DYNAMIC' && props.keepUnusedOptionsAvailable !== false;

  const allowNewOptions = mode === 'MULTIPLE' && props.allowNewOptions === true;

  const availableOptions = useMemo(() => {
    const result: Option<Value>[] = [];
    if (keepUnusedOptionsAvailable) {
      result.push(...virtualOptions);
    }
    result.push(...(options as Option<Value>[]));
    if (mode === 'DYNAMIC') {
      const isOptionExists = value != null && result.some((x) => compare(x.value, value));
      if (!isOptionExists && value != null) {
        result.unshift({ label: value, value: value as Value, isVirtual: true });
      }
    } else if (mode === 'MULTIPLE' && allowNewOptions) {
      for (const valueItem of value ?? []) {
        const isOptionExists = result.some((x) => compare(x.value, valueItem));
        if (!isOptionExists) {
          result.unshift({ label: valueItem, value: valueItem, isVirtual: true });
        }
      }
    }
    return result;
  }, [virtualOptions, options, mode, value, keepUnusedOptionsAvailable, allowNewOptions]);

  const applySearchStringValue = useCallback(
    (searchString: string, value: Value | Value[] | undefined | string) => {
      let newValue;
      if (mode === 'MULTIPLE') {
        const parsedValues = parseSearchString<Value>(
          availableOptions,
          searchString,
          !allowNewOptions,
        );
        newValue = uniq([...((value as Value[]) ?? []), ...parsedValues] as Value[]);
      } else if (mode === 'SINGLE' || mode === 'DYNAMIC' || mode == null) {
        const parsedValues = parseSearchString<Value>(
          availableOptions,
          searchString,
          mode !== 'DYNAMIC',
        );
        newValue = parsedValues[0] ?? value;
      } else {
        newValue = value;
      }
      setSearchText('');
      if (!isEqual(value, newValue)) {
        onChange?.(newValue);
      }
    },
    [mode, availableOptions, onChange, allowNewOptions],
  );

  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setIsOpen(isOpen);
      if (!isOpen && searchText != null && searchText !== '') {
        applySearchStringValue(searchText, props.value);
      }
    },
    [applySearchStringValue, props.value, searchText],
  );

  const { refs, floatingStyles, context, update } = useFloating({
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(2),
      flip(),
      floatingUiSize({
        apply: (state) => {
          state.elements.floating.style.minWidth = `${Math.max(
            state.rects.reference.width,
            MIN_WIDTH,
          )}px`;
          state.elements.floating.style.maxWidth = `${Math.min(
            state.availableWidth - VIEWPORT_PADDING,
            MAX_WIDTH,
          )}px`;
          state.elements.floating.style.maxHeight = `${Math.max(
            state.availableHeight - VIEWPORT_PADDING,
            MIN_HEIGHT,
          )}px`;
        },
      }),
    ],
    open: isOpen,
    onOpenChange: handleOpenChange,
    placement: 'bottom-start',
    strategy: 'fixed',
  });

  // To fix bug in QuickFilters, force layout update after select is open
  useLayoutEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        update();
      }, 0);
    }
  }, [update, isOpen]);

  const dismiss = useDismiss(context, {
    ancestorScroll: true,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const selectedOptions: Option<Value>[] = useMemo(() => {
    return availableOptions.filter((option): option is Option<Value> => {
      if (mode === 'SINGLE' || mode === 'DYNAMIC' || mode == undefined) {
        return option.value === value;
      } else if (mode === 'MULTIPLE') {
        return value?.includes(option.value as Value) ?? false;
      } else {
        return false;
      }
    });
  }, [value, mode, availableOptions]);

  const [isFocused, setIsFocused] = useState(false);
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);

  const isEmpty = selectedOptions.length === 0;
  const showClearIcon = allowClear && !isEmpty;
  const showCopyIcon = isCopyable && props.value != null;

  const rightIconsCount = useMemo(() => {
    return 1 + (showClearIcon ? 1 : 0) + (isLoading ? 1 : 0) + (showCopyIcon ? 1 : 0);
  }, [showClearIcon, isLoading, showCopyIcon]);

  const handleChangeSearchText = (value: string) => {
    setSearchText(value);
    if (value.includes(SEPARATOR)) {
      applySearchStringValue(value, props.value);
    }
  };

  const handleCopy = useCallback(
    async (e: React.MouseEvent<ReactSVGElement>) => {
      e.stopPropagation();
      if (props.value) {
        const valueToCopy = Array.isArray(props.value)
          ? props.value.join(SEPARATOR)
          : props.value.toString();
        if (valueToCopy && valueToCopy.length > 0) {
          try {
            await copyTextToClipboard(valueToCopy);
            message.success('Copied');
          } catch (error) {
            message.fatal(`Failed to copy: ${getErrorMessage(error)}`);
          }
        }
      }
    },
    [props.value],
  );

  const optionsToShow: Option<Value>[] = useMemo(() => {
    let result = [...availableOptions];

    if (searchText) {
      result = result.filter((x) => filterOption(searchText ?? '', x));
    }
    if (props.mode === 'DYNAMIC' || allowNewOptions) {
      const values = props.mode === 'DYNAMIC' ? [props.value] : props.value ?? [];
      if (searchText) {
        const isOptionExists = values.some((value) =>
          result.some((x) => compare(x.value, value) || compare(x.value, searchText)),
        );
        if (!isOptionExists) {
          result = [
            {
              label: `Use "${searchText.trim()}"`,
              value: searchText.trim() as Value,
              isVirtual: true,
            },
            ...result,
          ];
        }
      }
    }
    return result;
  }, [props.value, searchText, availableOptions, allowNewOptions, props.mode]);

  const portalId = useMemo(() => {
    return `select-portal-${props.testId ?? id}`;
  }, [props.testId, id]);

  return (
    <>
      {!hiddenDropdown && (
        <FloatingPortal id={portalId}>
          <div
            style={floatingStyles}
            ref={refs.setFloating}
            {...getFloatingProps()}
            className={cn(s.menuWrapper, { [s.isOpen]: isOpen })}
            data-cy={cn(`select-menu-wrapper`, isOpen && 'open')}
          >
            {optionsToShow.length > 0 ? (
              <SelectMenu<Value>
                options={optionsToShow}
                selectedValues={
                  Array.isArray(props.value)
                    ? props.value
                    : props.value
                    ? [props.value as Value]
                    : []
                }
                onSelectOption={(selectedValue, option) => {
                  if (props.mode === 'SINGLE' || props.mode === undefined) {
                    props.onChange?.(selectedValue);
                    setIsOpen(false);
                    setSearchText('');
                  } else if (props.mode === 'MULTIPLE') {
                    const newValue = props.value?.includes(selectedValue)
                      ? props.value?.filter((v) => v !== selectedValue)
                      : [...(props.value ?? []), selectedValue];
                    props.onChange?.(newValue);
                  } else if (props.mode === 'DYNAMIC') {
                    if (option.isVirtual) {
                      setVirtualOptions((prev) => {
                        if (prev.some((x) => compare(x.value, selectedValue))) {
                          return prev;
                        }
                        return [
                          ...prev,
                          { label: selectedValue, value: selectedValue, isVirtual: true },
                        ];
                      });
                    }
                    const newValue = selectedValue?.toString() ?? '';
                    setIsOpen(false);
                    setSearchText('');
                    props.onChange?.(newValue);
                  }
                }}
                showCheckboxes={props.mode === 'MULTIPLE'}
              />
            ) : (
              <div className={s.noOptions}>{props.notFoundContent ?? 'No options available'}</div>
            )}
          </div>
        </FloatingPortal>
      )}
      <div
        ref={(ref) => {
          refs.setReference(ref);
          props.rootRef?.(ref);
        }}
        style={width != null ? { width } : undefined}
        {...getReferenceProps()}
        className={s.rootWrapper}
        role="combobox"
        data-cy={'input'}
      >
        <div
          data-cy={cn(
            props.testId ?? `select-root-${id}`,
            'select-root',
            isEmpty && 'empty',
            isDisabled && 'disabled',
            isLoading && CY_LOADING_FLAG_CLASS,
          )}
          data-portal-id={portalId}
          className={cn(
            s.root,
            s[`size-${size}`],
            s[`type-${props.mode ?? 'SINGLE'}`],
            s[`rightIconsCount-${rightIconsCount}`],
            {
              [s.isError]: isError,
              [s.isSearchEmpty]: searchText == null || searchText === '',
              [s.isEmpty]: isEmpty,
              [s.isFocused]: isFocused,
              [s.isOpen]: isOpen,
              [s.isDisabled]: isDisabled,
              [s.allowClear]: allowClear,
              [s.fixedHeight]: fixedHeight,
              [s.hideBorders]: hideBorders,
            },
          )}
          onClick={() => {
            if (!isFocused) {
              inputRef?.focus();
            }
          }}
        >
          <div className={s.placeholder}>
            {placeholderIcon && <div className={s.placeholderIcon}>{placeholderIcon}</div>}
            {placeholder}
          </div>
          {selectedOptions.length > 0 &&
            (props.mode === 'MULTIPLE' ? (
              <RenderTags
                options={selectedOptions}
                onRemove={(value) => {
                  props.onChange?.(props.value?.filter((v) => v !== value));
                }}
              />
            ) : (
              <span className={s.selectedOption} key={key(selectedOptions[0].value)}>
                <span className={s.selectedOptionLabel}>{selectedOptions[0].label}</span>
              </span>
            ))}
          <input
            type="text"
            onFocus={() => {
              setIsFocused(true);
              if (!isOpen) {
                handleOpenChange(true);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
            }}
            className={s.input}
            ref={setInputRef}
            disabled={isDisabled}
            value={searchText ?? ''}
            onChange={(e) => handleChangeSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                handleOpenChange(false);
              }
            }}
          />
          <div className={s.rightIcons}>
            {showCopyIcon && (
              <FileCopyLineIcon onClick={handleCopy} className={cn(s.rightIcon, s.copyIcon)} />
            )}
            {showClearIcon && (
              <CloseCircleFillIcon
                className={cn(s.rightIcon, s.clearIcon)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (props.mode === 'MULTIPLE') {
                    props.onChange?.([]);
                  } else {
                    props.onChange?.(undefined);
                  }
                }}
              />
            )}
            {isLoading && <LoaderIcon className={cn(s.rightIcon, s.loadingIcon)} />}
            <ArrowDownIcon
              className={cn(s.rightIcon, s.arrowDownIcon)}
              onClick={() => {
                handleOpenChange(!isOpen);
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function RenderTags<Value extends Comparable>(props: {
  options: Option<Value>[];
  onRemove: (value: Value) => void;
}) {
  return (
    <>
      {props.options.map((option) => (
        <div className={s.tagWrapper} key={key(option.value)}>
          <Tag
            key={key(option.value)}
            actions={[
              {
                icon: <CloseLineIcon className={s.tagRemoveIcon} />,
                key: 'remove',
                action: () => {
                  props.onRemove(option.value);
                },
              },
            ]}
          >
            {option.label}
          </Tag>
        </div>
      ))}
    </>
  );
}
