import React from 'react';
import cn from 'clsx';
import FormField from '../GenericFormField';
import s from './index.module.less';
import Label, { Props as LabelProps } from '@/components/library/Label';

export interface InputProps<Value> {
  isError?: boolean;
  isDisabled?: boolean;
  value?: Value;
  onChange?: (newValue: Value) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface Props<FormValues, Key extends keyof FormValues = keyof FormValues> {
  name: Key;
  label: string;
  input: React.FunctionComponent<InputProps<FormValues[Key]>>;
  labelProps?: Partial<LabelProps>;
}

export default function InputField<
  FormValues = Record<string, unknown>,
  Key extends keyof FormValues = keyof FormValues,
>(props: Props<FormValues, Key>): JSX.Element {
  const { name, label, labelProps, input: Input } = props;
  return (
    <FormField<FormValues> name={name}>
      {({ value, validationResult, isVisited, onChange, ...rest }) => {
        const isError = validationResult != null;
        const showError = isError && isVisited;
        return (
          <Label {...labelProps} label={label}>
            <Input value={value as any} onChange={onChange} isError={showError} {...rest} />
            {validationResult && showError && (
              <div className={cn(s.hint, isError && s.isError)}>{validationResult}</div>
            )}
          </Label>
        );
      }}
    </FormField>
  );
}
