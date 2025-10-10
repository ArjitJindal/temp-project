import { Input } from 'antd';
import cn from 'clsx';
import React, { useImperativeHandle, useRef } from 'react';
import s from './styles.module.less';
import { InputProps } from '@/components/library/Form';

export type TextAreaRef = {
  focus: () => void;
};

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

function TextArea(props: Props, ref: React.Ref<TextAreaRef>) {
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

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

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
        ref={inputRef}
        onFocus={onFocus || undefined}
        onBlur={onBlur || undefined}
        style={{ minHeight }}
      />
      {description && <div className={s.description}>{description}</div>}
    </div>
  );
}

export default React.forwardRef(TextArea);
