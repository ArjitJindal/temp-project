import React, { InputHTMLAttributes } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form/InputField';

export const styles = s;

export interface Props extends InputProps<string> {
  placeholder?: string;
  size?: 'DEFAULT' | 'SMALL';
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
  return (
    <input
      {...htmlAttrs}
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
