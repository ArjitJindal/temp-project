import React from 'react';
import cn from 'clsx';
import { Select as AntSelect } from 'antd';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form/InputField';

interface Option {
  value: string;
  label: string;
  isDisabled?: boolean;
}

interface CommonProps {
  mode?: 'SINGLE' | 'MULTIPLE';
  placeholder?: string;
  size?: 'DEFAULT' | 'SMALL';
  options: Option[];
}

interface SingleProps extends CommonProps, InputProps<string> {
  mode?: 'SINGLE' | undefined;
}

interface MultipleProps extends CommonProps, InputProps<string[]> {
  mode: 'MULTIPLE';
}

type Props = SingleProps | MultipleProps;

export default function Select(props: Props) {
  const { isDisabled, options, placeholder, size = 'DEFAULT', isError, onFocus, onBlur } = props;
  const sharedProps = {
    disabled: isDisabled,
    options: options,
    placeholder: placeholder,
    allowClear: true,
    onFocus: onFocus,
    onBlur: onBlur,
  };

  return (
    <div className={cn(s.root, isError && s.isError, s[`size-${size}`])}>
      {props.mode === 'MULTIPLE' ? (
        <AntSelect<string[]>
          {...sharedProps}
          mode={'tags'}
          value={props.value}
          onChange={(newValue: string[]) => {
            props.onChange?.(newValue);
          }}
        />
      ) : (
        <AntSelect<string>
          {...sharedProps}
          value={props.value}
          onChange={(newValue: string) => {
            props.onChange?.(newValue);
          }}
        />
      )}
    </div>
  );
}
