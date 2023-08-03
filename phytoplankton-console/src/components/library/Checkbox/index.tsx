import React, { useRef } from 'react';
import cn from 'clsx';
import _ from 'lodash';
import s from './style.module.less';
import CheckLineIcon from '@/components/ui/icons/Remix/system/check-line.react.svg';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<boolean> {
  testName?: string;
  label?: string;
  extraLeftLabelMargin?: boolean;
}

export default function Checkbox(props: Props) {
  const {
    isDisabled,
    value,
    onChange,
    isError: _isError,
    testName,
    extraLeftLabelMargin = false,
    ...rest
  } = props;
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={s.container}>
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
          data-cy={`${testName}-checkbox`}
          {...rest}
        />
        <div className={s.content}>
          <div className={cn(s.indeterminate, value === undefined && s.isVisible)} />
          <CheckLineIcon className={s.icon} />
        </div>
      </div>
      {props.label && (
        <div className={cn(s[`label${extraLeftLabelMargin ? '-EXTRA_MARGIN' : ''}`])}>
          {props.label}
        </div>
      )}
    </div>
  );
}
