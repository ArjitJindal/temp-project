import React, { useRef } from 'react';
import cn from 'clsx';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

type Sizes = 'S' | 'M' | 'L';

export interface Props extends InputProps<boolean> {
  size?: Sizes;
  testName?: string;
}

export default function Radio(props: Props) {
  const { size = 'M', isDisabled, value, onChange, isError: _isError, testName, ...rest } = props;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={cn(s.root, s[`size-${size}`])}>
      <input
        ref={ref}
        className={s.input}
        type="checkbox"
        disabled={isDisabled}
        checked={value ?? false}
        onChange={(e) => {
          onChange?.(e.target.checked);
        }}
        data-cy={testName}
        {...rest}
      />
      <div className={s.content}></div>
    </div>
  );
}
