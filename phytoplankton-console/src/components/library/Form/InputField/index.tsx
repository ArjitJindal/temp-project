import cn from 'clsx';
import React from 'react';
import { toString } from 'lodash';
import s from './index.module.less';
import Label, { Props as LabelProps } from '@/components/library/Label';
import { InputProps } from '@/components/library/Form';
import GenericFormField from '@/components/library/Form/GenericFormField';

interface Props<FormValues, Key extends keyof FormValues> {
  name: Key;
  label: React.ReactNode;
  description?: string;
  labelProps?: Partial<LabelProps>;
  children: (inputProps: InputProps<FormValues[Key]>) => JSX.Element;
  hideLabel?: boolean;
}

export default function InputField<FormValues, Key extends keyof FormValues = keyof FormValues>(
  props: Props<FormValues, Key>,
): JSX.Element {
  const { name, label, description, labelProps, children, hideLabel } = props;
  return (
    <GenericFormField<FormValues, Key> name={name}>
      {(childrenProps) => {
        const { value, onChange, isValid, isDisabled, showError, errorMessage, onFocus, onBlur } =
          childrenProps;
        return hideLabel ? (
          <label htmlFor={toString(name)}>
            {children({
              value,
              onChange,
              isError: showError,
              isDisabled: isDisabled,
              onFocus: onFocus,
              onBlur: onBlur,
            })}
            {showError && <Hint isError={!isValid}>{errorMessage ?? 'Invalid field'}</Hint>}
          </label>
        ) : (
          <Label label={label} description={description} {...labelProps}>
            {children({
              name: String(name),
              value,
              onChange,
              isError: showError,
              isDisabled: isDisabled,
              onFocus: onFocus,
              onBlur: onBlur,
            })}
            {showError && <Hint isError={!isValid}>{errorMessage ?? 'Invalid field'}</Hint>}
          </Label>
        );
      }}
    </GenericFormField>
  );
}

export function Hint(props: { isError: boolean; children: string }) {
  return <div className={cn(s.hint, props.isError && s.isError)}>{props.children}</div>;
}
