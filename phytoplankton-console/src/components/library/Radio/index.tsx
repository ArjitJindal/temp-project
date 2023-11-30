import React, { useRef } from 'react';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<boolean> {
  testName?: string;
}

export default function Radio(props: Props) {
  const { isDisabled, value, onChange, isError: _isError, testName, ...rest } = props;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={s.root}>
      <input
        ref={ref}
        className={s.input}
        type="checkbox"
        disabled={isDisabled}
        checked={value}
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
