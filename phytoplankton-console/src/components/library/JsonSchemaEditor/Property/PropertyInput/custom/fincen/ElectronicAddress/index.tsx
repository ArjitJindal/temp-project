import React from 'react';
import { ExtendedSchema, UiSchemaElectronicAddress } from '../../../../../types';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';

interface Value {
  ElectronicAddressTypeCode?: 'E' | 'U';
  ElectronicAddressText?: string;
}

interface Props extends InputProps<Value> {
  uiSchema?: UiSchemaElectronicAddress;
  schema: ExtendedSchema;
}

export default function ElectronicAddress(props: Props) {
  const { value, onChange } = props;

  const [prevValues, setPrevValues] = React.useState<{
    [key: string]: string;
  }>({});

  let placeholder: string | undefined = undefined;
  if (value?.ElectronicAddressTypeCode === 'E') {
    placeholder = 'Enter valid e-mail address';
  } else if (value?.ElectronicAddressTypeCode === 'U') {
    placeholder = 'Enter valid URL';
  }
  return (
    <div className={s.root}>
      <Select
        value={value?.ElectronicAddressTypeCode}
        onChange={(newValue) => {
          if (newValue == null) {
            onChange?.(undefined);
          } else {
            onChange?.({
              ...value,
              ElectronicAddressTypeCode: newValue,
              ElectronicAddressText: prevValues[newValue] ?? '',
            });
          }
        }}
        options={[
          { label: 'Email', value: 'E' },
          { label: 'URL', value: 'U' },
        ]}
        placeholder={'Choose an address type'}
      />
      <TextInput
        placeholder={placeholder}
        isDisabled={value?.ElectronicAddressTypeCode == null}
        value={value?.ElectronicAddressText}
        onChange={(newValue) => {
          setPrevValues((prevState) => ({
            ...prevState,
            [value?.ElectronicAddressTypeCode ?? '']: newValue ?? '',
          }));
          onChange?.({
            ...value,
            ElectronicAddressText: newValue,
          });
        }}
      />
    </div>
  );
}
