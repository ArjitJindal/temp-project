import { Input } from 'antd';
import { TextAreaRef } from 'antd/lib/input/TextArea';
import cn from 'clsx';
import React from 'react';
import s from './styles.module.less';
import { InputProps } from '@/components/library/Form';

export interface Props extends InputProps<string> {
  className?: string;
  showCount?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  ref?: React.Ref<TextAreaRef>;
  minHeight?: string;
  isSuccess?: boolean;
  description?: string;
}

export default function TextArea(props: Props) {
  const {
    className,
    showCount,
    maxLength,
    value,
    onChange,
    rows,
    placeholder,
    isError,
    isDisabled,
    onFocus,
    onBlur,
    minHeight,
    isSuccess,
    description,
  } = props;
  return (
    <div className={s.root}>
      <Input.TextArea
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        showCount={showCount}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          s.input,
          className,
          isError && s.isError,
          isSuccess && s.isSuccess,
          !showCount && s.bareInput,
        )}
        disabled={isDisabled}
        ref={props.ref}
        onFocus={onFocus || undefined}
        onBlur={onBlur || undefined}
        style={{ minHeight }}
      />
      {description && <div className={s.description}>{description}</div>}
    </div>
  );
}
