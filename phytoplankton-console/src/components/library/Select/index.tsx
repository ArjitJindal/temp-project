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
import s from './style.module.less';
import SelectMenu from './SelectMenu';
import {
  DEFAULT_TAG_RENDERER,
  filterOption,
  InternalOption,
  parseSearchString,
  SEPARATOR,
} from './helpers';
import TagsStack, { TagsStackParams } from './TagsStack';
import Tags from './Tags';
import { useId } from '@/utils/hooks';
import { InputProps } from '@/components/library/Form';
import { Comparable, compare, key } from '@/utils/comparable';
import { getErrorMessage, isEqual, neverReturn } from '@/utils/lang';
import CloseCircleFillIcon from '@/components/ui/icons/Remix/system/close-circle-fill.react.svg';
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

export type TagRenderer<Value extends Comparable> = (props: {
  isHovered: boolean;
  isShadowed: boolean;
  isOnTop: boolean;
  isDisabled: boolean;
  isOptionFound: boolean;
  option: Option<Value>;
  onRemove: () => void;
}) => React.ReactNode;

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

export interface DynamicProps<Value extends Comparable>
  extends CommonProps,
    InputProps<Value | string> {
  mode: 'DYNAMIC';
  options: Option<Value>[];
  keepUnusedOptionsAvailable?: boolean;
}

export interface MultipleProps<Value extends Comparable> extends CommonProps, InputProps<Value[]> {
  mode: 'MULTIPLE';
  options: Option<Value>[];
  tagsStack?: boolean | TagsStackParams<Value>;
  tagRenderer?: TagRenderer<Value>;
}

export interface DynamicMultipleProps<Value extends Comparable>
  extends CommonProps,
    InputProps<(Value | string)[]> {
  mode: 'MULTIPLE_DYNAMIC';
  options: Option<Value>[];
  tagsStack?: boolean | TagsStackParams<Value>;
  tagRenderer?: TagRenderer<Value>;
}

export type Props<Value extends Comparable> =
  | SingleProps<Value>
  | MultipleProps<Value>
  | DynamicMultipleProps<Value>
  | DynamicProps<Value>;

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
    size = 'DEFAULT',
    hiddenDropdown = false,
    fixedHeight = false,
    hideBorders = false,
    width,
    placeholderIcon,
    placeholder,
    onSearch,
  } = props;

  const id = useId(`select-`);

  const [searchText, setSearchText] = useState<string | undefined>(undefined);

  const handleChangeSearchText = useCallback(
    (text) => {
      setSearchText(text);
      onSearch?.(text);
    },
    [onSearch],
  );

  const [virtualOptions, setVirtualOptions] = useState<Option<Value>[]>([]);

  const keepUnusedOptionsAvailable =
    props.mode === 'DYNAMIC' && props.keepUnusedOptionsAvailable !== false;

  const allowNewOptions = mode === 'MULTIPLE_DYNAMIC' || mode === 'DYNAMIC';

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
    } else if (mode === 'MULTIPLE_DYNAMIC') {
      for (const valueItem of value ?? []) {
        const isOptionExists = result.some((x) => compare(x.value, valueItem));
        if (!isOptionExists) {
          result.unshift({ label: valueItem, value: valueItem as Value, isVirtual: true });
        }
      }
    }
    return result;
  }, [virtualOptions, options, mode, value, keepUnusedOptionsAvailable]);

  const applySearchStringValue = useCallback(
    (
      searchString: string,
      value: Value | Value[] | undefined | string | string[] | (string | Value)[],
    ) => {
      let newValue;
      if (mode === 'MULTIPLE' || mode === 'MULTIPLE_DYNAMIC') {
        const parsedValues = parseSearchString<Value>(
          availableOptions,
          searchString,
          mode !== 'MULTIPLE_DYNAMIC',
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
      handleChangeSearchText('');
      if (!isEqual(value, newValue)) {
        onChange?.(newValue);
      }
    },
    [mode, availableOptions, onChange, handleChangeSearchText],
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
      } else if (mode === 'MULTIPLE_DYNAMIC') {
        return value?.includes(option.value as string) ?? false;
      } else {
        return false;
      }
    });
  }, [value, mode, availableOptions]);

  const [isFocused, setIsFocused] = useState(false);
  const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);

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
    if (allowNewOptions) {
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

  const notFoundOptions = useMemo((): Option<Value>[] => {
    let values: (string | Value)[];
    if (props.mode === 'SINGLE' || props.mode === 'DYNAMIC' || props.mode == null) {
      values = props.value != null ? [props.value] : [];
    } else if (props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC') {
      values = props.value ?? [];
    } else {
      values = neverReturn(props.mode, []);
    }

    return values
      .filter((x) => !availableOptions.some((option) => compare(x, option.value)))
      .map((x) => ({
        value: x,
        label: x,
      })) as Option<Value>[];
  }, [props.mode, props.value, availableOptions]);

  const isEmpty = selectedOptions.length === 0 && notFoundOptions.length === 0;

  const showClearIcon = allowClear && !isEmpty;
  const showCopyIcon = isCopyable && props.value != null;

  const rightIconsCount = useMemo(() => {
    return 1 + (showClearIcon ? 1 : 0) + (isLoading ? 1 : 0) + (showCopyIcon ? 1 : 0);
  }, [showClearIcon, isLoading, showCopyIcon]);

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
                  (Array.isArray(props.value)
                    ? props.value
                    : props.value
                    ? [props.value]
                    : []) as Value[]
                }
                onSelectOption={(selectedValue, option) => {
                  if (props.mode === 'SINGLE' || !('mode' in props) || props.mode === undefined) {
                    props.onChange?.(selectedValue);
                    setIsOpen(false);
                    handleChangeSearchText('');
                  } else if (props.mode === 'MULTIPLE') {
                    const newValue = props.value?.includes(selectedValue)
                      ? props.value?.filter((v) => v !== selectedValue)
                      : [...(props.value ?? []), selectedValue];
                    props.onChange?.(newValue);
                  } else if (props.mode === 'MULTIPLE_DYNAMIC') {
                    const newValue = props.value?.includes(selectedValue as string)
                      ? props.value?.filter((v) => v !== selectedValue)
                      : [...(props.value ?? []), selectedValue];
                    props.onChange?.(newValue as string[]);
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
                    handleChangeSearchText('');
                    props.onChange?.(newValue);
                  }
                }}
                showCheckboxes={props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC'}
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
              [s.tagsStack]:
                (props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC') &&
                (props.tagsStack === true ||
                  (typeof props.tagsStack === 'object' && props.tagsStack.enabled === true)),
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
          <RenderValue<Value>
            {...props}
            notFoundOptions={notFoundOptions}
            selectedOptions={selectedOptions}
          />
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
            onChange={(e) => {
              const value = e.target.value;
              handleChangeSearchText(value);
              if (value.includes(SEPARATOR)) {
                applySearchStringValue(value, props.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                handleOpenChange(false);
              } else if (e.key === 'Enter') {
                if (isOpen && searchText != null && searchText !== '') {
                  applySearchStringValue(searchText, props.value);
                }
                handleOpenChange(!isOpen);
              } else if (e.key === 'Escape') {
                setSearchText('');
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
                  if (props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC') {
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

function RenderValue<Value extends Comparable>(
  props: Props<Value> & {
    selectedOptions: Option<Value>[];
    notFoundOptions: Option<Value>[];
  },
) {
  const { selectedOptions, notFoundOptions, isDisabled = false } = props;

  const allOptions: InternalOption<Value>[] = useMemo(
    () => [
      ...selectedOptions.map((x) => ({ ...x, isNotFoundOption: false })),
      ...notFoundOptions.map((x) => ({ ...x, isNotFoundOption: true })),
    ],
    [selectedOptions, notFoundOptions],
  );

  if ((props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC') && props.tagsStack != null) {
    const tagsStackParams: TagsStackParams<Value> =
      typeof props.tagsStack === 'boolean' ? { enabled: props.tagsStack } : props.tagsStack;
    if (tagsStackParams.enabled) {
      return (
        <TagsStack
          params={tagsStackParams}
          isDisabled={isDisabled}
          selectedOptions={allOptions}
          tagRenderer={props.tagRenderer}
          onRemove={(value) => {
            props.onChange?.(props.value?.filter((v) => v !== value) as Value[]);
          }}
        />
      );
    }
  }

  return (
    <>
      {allOptions.length > 0 &&
        (props.mode === 'MULTIPLE' || props.mode === 'MULTIPLE_DYNAMIC' ? (
          <Tags
            isDisabled={isDisabled}
            selectedOptions={allOptions}
            onRemove={(value) => {
              props.onChange?.(props.value?.filter((v) => v !== value) as Value[]);
            }}
            tagRenderer={props.tagRenderer ?? DEFAULT_TAG_RENDERER}
          />
        ) : (
          <span className={s.selectedOption} key={key(allOptions[0].value)}>
            <span className={s.selectedOptionLabel}>{allOptions[0].label}</span>
          </span>
        ))}
    </>
  );
}
