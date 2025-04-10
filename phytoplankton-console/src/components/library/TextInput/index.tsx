import React, { InputHTMLAttributes, useEffect, useRef, useCallback, useState } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CrossIcon from './cross.react.svg';
import LoaderIcon from '@/components/ui/icons/Remix/system/loader-4-line.react.svg';
import { InputProps } from '@/components/library/Form';

export const styles = s;

export interface Props extends InputProps<string> {
  placeholder?: string;
  size?: 'X1' | 'X2';
  allowClear?: boolean;
  htmlAttrs?: InputHTMLAttributes<HTMLInputElement>;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  innerRef?: React.RefObject<HTMLInputElement>;
  testName?: string;
  enableEmptyString?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  isSuccess?: boolean;
  description?: string;
  disableBorders?: boolean;
  className?: string;
}

export default function TextInput(props: Props) {
  const {
    isDisabled,
    placeholder,
    htmlAttrs,
    size = 'X1',
    isError,
    allowClear,
    value,
    onChange,
    onFocus,
    onBlur,
    onArrowUp,
    onArrowDown,
    testName = 'input text-input',
    innerRef,
    enableEmptyString = false,
    icon,
    iconRight,
    isSuccess,
    isLoading,
    description,
    disableBorders = false,
    className,
  } = props;
  const defaultRef = useRef<HTMLInputElement>(null);
  const ref = innerRef === undefined ? defaultRef : innerRef;
  usePreventWheelEvent(ref, props);

  const [isFocused, setFocused] = useState(false);
  const handleFocus = useCallback(() => {
    onFocus?.();
    setFocused(true);
  }, [onFocus]);
  const handleBlur = useCallback(() => {
    onBlur?.();
    setFocused(false);
  }, [onBlur]);

  const isFilled = value != null && value !== '';

  return (
    <div className={cn(s.root, className, disableBorders && s.disableBorders)}>
      <div
        className={cn(
          s.inputWrapper,
          s[`size-${size}`],
          isError && s.isError,
          !isError && isSuccess && s.isSuccess,
          isLoading && s.isLoading,
          isDisabled && s.isDisabled,
          isFocused && s.isFocused,
          isFilled && s.isFilled,
          className,
        )}
      >
        {icon && <div className={cn(s.icon, s.iconLeft)}>{icon}</div>}
        <input
          {...htmlAttrs}
          ref={ref}
          placeholder={placeholder}
          className={cn(s.input, s[`size-${size}`], isError && s.isError)}
          disabled={isDisabled}
          value={value ?? ''}
          onChange={(e) => {
            if (enableEmptyString && e.target.value === '') {
              onChange?.(e.target.value);
              return;
            }
            onChange?.(e.target.value || undefined);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-cy={testName}
          onKeyDown={
            onArrowUp || onArrowDown
              ? (e) => {
                  if (e.key === 'ArrowUp') {
                    onArrowUp?.();
                  } else if (e.key === 'ArrowDown') {
                    onArrowDown?.();
                  }
                }
              : undefined
          }
        />
        {allowClear && (
          <CrossIcon
            aria-label="Clear"
            role="button"
            className={cn(s.icon, s.iconRight, s.clearIcon, value != null && s.isVisible)}
            onClick={() => {
              onChange?.(undefined);
            }}
          />
        )}
        {isLoading && <LoaderIcon className={cn(s.icon, s.iconRight, s.loadingIcon)} />}
        {iconRight && <div className={cn(s.icon, s.iconRight)}>{iconRight}</div>}
      </div>
      {description && <div className={s.description}>{description}</div>}
    </div>
  );
}

/*
  We do this to prevent accidental changes in number inputs when scrolling
 */
function usePreventWheelEvent(ref: React.RefObject<HTMLInputElement>, props: Props) {
  const { htmlAttrs } = props;
  useEffect(() => {
    const current = ref.current;
    if (htmlAttrs?.type === 'number' && current) {
      const preventDefaultListener = (e: MouseEvent) => {
        e.preventDefault();
      };
      current.addEventListener('wheel', preventDefaultListener, { passive: false });
      return () => {
        current.removeEventListener('wheel', preventDefaultListener);
      };
    }
  }, [ref, htmlAttrs?.type]);
}
