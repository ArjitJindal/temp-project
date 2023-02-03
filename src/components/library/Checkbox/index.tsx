import React, { useRef } from 'react';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<boolean> {}

export default function Checkbox(props: Props) {
  const { isDisabled, value, onChange, isError: _isError, ...rest } = props;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={s.root}>
      <input
        ref={ref}
        className={s.input}
        type="checkbox"
        disabled={isDisabled}
        checked={value || false}
        onChange={(e) => {
          onChange?.(e.target.checked);
        }}
        {...rest}
      />
      <div className={s.content}>
        <CheckLineIcon className={s.icon} />
      </div>
    </div>
  );
}
