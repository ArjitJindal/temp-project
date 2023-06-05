import React from 'react';
import { Props as LabelProps } from '@/components/library/Label';
import InputField from '@/components/library/Form/InputField';
import { InputProps } from '@/components/library/Form';

interface Props<FormValues, Key extends keyof FormValues = keyof FormValues> {
  name: Key;
  label: string;
  input: React.FunctionComponent<InputProps<FormValues[Key]>>;
  labelProps?: Partial<LabelProps>;
}

export default function BasicInputField<
  FormValues = Record<string, unknown>,
  Key extends keyof FormValues = keyof FormValues,
>(props: Props<FormValues, Key>): JSX.Element {
  const { name, label, labelProps, input: Input } = props;
  return (
    <InputField<FormValues, Key> name={name} label={label} labelProps={labelProps}>
      {(inputProps) => <Input {...inputProps} />}
    </InputField>
  );
}
