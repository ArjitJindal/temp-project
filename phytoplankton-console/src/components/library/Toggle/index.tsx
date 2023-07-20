import React from 'react';
import Switch, { ReactSwitchProps } from 'react-switch';
import { InputProps } from '../Form';
import s from './style.module.less';
import COLORS from '@/components/ui/colors';

interface Props extends InputProps<boolean>, Omit<ReactSwitchProps, 'checked' | 'onChange'> {
  large?: boolean;
  showOnOffLabel?: boolean;
  green?: boolean;
  loading?: boolean;
}

export default function Toggle(props: Props) {
  const { value, onChange, showOnOffLabel, large, green, disabled, ...rest } = props;
  return (
    <Switch
      height={large ? 40 : 32}
      width={large ? 80 : 72}
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
