import React from 'react';
import Switch, { ReactSwitchProps } from 'react-switch';
import { InputProps } from '../Form';
import s from './style.module.less';
import COLORS from '@/components/ui/colors';

export type ToggleSize = 'XS' | 'SMALL' | 'DEFAULT' | 'LARGE';

interface Props extends InputProps<boolean>, Omit<ReactSwitchProps, 'checked' | 'onChange'> {
  size?: ToggleSize;
  showLabel?: boolean;
  green?: boolean;
  loading?: boolean;
  label?: string;
  testId?: string;
}

export default function Toggle(props: Props) {
  const {
    value,
    onChange,
    showLabel,
    size = 'DEFAULT',
    green,
    disabled,
    label,
    testId,
    ...rest
  } = props;
  let height = 32;
  let width = 72;
  if (size === 'SMALL') {
    height = 26;
    width = 50;
  } else if (size === 'LARGE') {
    height = 40;
    width = 80;
  } else if (size === 'XS') {
    height = 20;
    width = 40;
  }
  return (
    <div data-cy={testId}>
      <Switch
        data-cy={'toggle'}
        height={height}
        width={width}
        uncheckedIcon={showLabel ? <div className={s.label}>{label ?? 'OFF'}</div> : false}
        checkedIcon={showLabel ? <div className={s.label}>{label ?? 'ON'}</div> : false}
        onColor={disabled ? COLORS.gray5 : green ? COLORS.leafGreen.base : COLORS.brandBlue.base}
        checked={value === true}
        onChange={(value) => {
          onChange?.(value);
        }}
        disabled={disabled}
        {...rest}
      />
    </div>
  );
}
