import React, { InputHTMLAttributes, useEffect, useRef } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

export const styles = s;

export interface Props extends InputProps<string> {
  placeholder?: string;
  size?: 'DEFAULT' | 'LARGE';
  htmlAttrs?: InputHTMLAttributes<HTMLInputElement>;
}

export default function TextInput(props: Props) {
  const {
    isDisabled,
    placeholder,
    htmlAttrs,
    size = 'DEFAULT',
    isError,
    value,
    onChange,
    onFocus,
    onBlur,
  } = props;

  const ref = useRef<HTMLInputElement>(null);
  usePreventWheelEvent(ref, props);

  return (
    <input
      {...htmlAttrs}
      ref={ref}
      placeholder={placeholder}
      className={cn(s.root, s[`size-${size}`], isError && s.isError)}
      disabled={isDisabled}
      value={value ?? ''}
      onChange={(e) => {
        onChange?.(e.target.value);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
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
