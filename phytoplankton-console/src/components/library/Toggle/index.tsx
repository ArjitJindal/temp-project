import React from 'react';
import Switch, { ReactSwitchProps } from 'react-switch';
import { InputProps } from '../Form';
import s from './style.module.less';
import COLORS from '@/components/ui/colors';

export type ToggleSize = 'SMALL' | 'DEFAULT' | 'LARGE';

interface Props extends InputProps<boolean>, Omit<ReactSwitchProps, 'checked' | 'onChange'> {
  size?: ToggleSize;
  showOnOffLabel?: boolean;
  green?: boolean;
  loading?: boolean;
}

export default function Toggle(props: Props) {
  const { value, onChange, showOnOffLabel, size = 'DEFAULT', green, disabled, ...rest } = props;
  let height = 32;
  let width = 72;
  if (size === 'SMALL') {
    height = 26;
    width = 50;
  } else if (size === 'LARGE') {
    height = 40;
    width = 80;
  }
  return (
    <Switch
      height={height}
      width={width}
      uncheckedIcon={showOnOffLabel ? <div className={s.label}>OFF</div> : false}
      checkedIcon={showOnOffLabel ? <div className={s.label}>ON</div> : false}
      onColor={disabled ? COLORS.gray5 : green ? COLORS.leafGreen.base : COLORS.brandBlue.base}
      checked={value === true}
      onChange={(value) => {
        onChange?.(value);
      }}
      disabled={disabled}
      {...rest}
    />
  );
}
