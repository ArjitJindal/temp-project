import React, { InputHTMLAttributes, useEffect, useRef } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import CrossIcon from './cross.react.svg';
import { InputProps } from '@/components/library/Form';

export const styles = s;

export interface Props extends InputProps<string> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  allowClear?: boolean;
  htmlAttrs?: InputHTMLAttributes<HTMLInputElement>;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  testName?: string;
}

export default function TextInput(props: Props) {
  const {
    isDisabled,
    placeholder,
    htmlAttrs,
    size = 'DEFAULT',
    isError,
    allowClear,
    value,
    onChange,
    onFocus,
    onBlur,
    onArrowUp,
    onArrowDown,
    testName,
  } = props;

  const ref = useRef<HTMLInputElement>(null);
  usePreventWheelEvent(ref, props);
  return (
    <div className={s.root}>
      <input
        {...htmlAttrs}
        ref={ref}
        autoFocus
        placeholder={placeholder}
        className={cn(s.input, s[`size-${size}`], isError && s.isError)}
        disabled={isDisabled}
        value={value ?? ''}
        onChange={(e) => {
          onChange?.(e.target.value);
        }}
        onFocus={onFocus ? () => onFocus() : undefined}
        onBlur={onBlur ? () => onBlur() : undefined}
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
          className={cn(s.clearIcon, value != null && s.isVisible)}
          onClick={() => {
            onChange?.(undefined);
          }}
        />
      )}
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
