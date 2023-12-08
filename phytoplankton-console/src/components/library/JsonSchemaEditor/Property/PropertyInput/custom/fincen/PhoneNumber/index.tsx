import React from 'react';
import { UiSchemaFincenPhoneNumber, ExtendedSchema } from '../../../../../types';
import s from './style.module.less';
import { InputProps } from '@/components/library/Form';
import TextInput from '@/components/library/TextInput';
import { useOrderedProps } from '@/components/library/JsonSchemaEditor/utils';
import Select from '@/components/library/Select';

interface Value {
  PhoneNumberExtensionText?: string;
  PhoneNumberText?: string;
  PhoneNumberTypeCode?: 'F' | 'M' | 'R' | 'W';
}

interface Props extends InputProps<Value> {
  uiSchema?: UiSchemaFincenPhoneNumber;
  schema: ExtendedSchema;
}

export default function PhoneNumber(props: Props) {
  const { schema } = props;
  const properties = useOrderedProps(schema);
  return (
    <div className={s.root}>
      {properties.some(({ name }) => name === 'PhoneNumberTypeCode') && (
        <div className={s.PhoneNumberTypeCode}>
          <Select
            placeholder="Type"
            value={props.value?.PhoneNumberTypeCode}
            options={[
              { value: 'F', label: 'Facsimile' },
              { value: 'M', label: 'Mobile' },
              { value: 'R', label: 'Residence' },
              { value: 'W', label: 'Work' },
            ]}
            onChange={(newValue) => {
              props.onChange?.({
                ...props.value,
                PhoneNumberTypeCode: newValue,
              });
            }}
          />
        </div>
      )}
      {properties.some(({ name }) => name === 'PhoneNumberExtensionText') && (
        <div className={s.PhoneNumberExtensionText}>
          <TextInput
            placeholder="Extension"
            value={props.value?.PhoneNumberExtensionText}
            onChange={(newValue) => {
              props.onChange?.({
                ...props.value,
                PhoneNumberExtensionText:
                  newValue == null || /^\d{0,6}$/.test(newValue)
                    ? newValue
                    : props.value?.PhoneNumberExtensionText,
              });
            }}
          />
        </div>
      )}
      {properties.some(({ name }) => name === 'PhoneNumberText') && (
        <div className={s.PhoneNumberText}>
          <TextInput
            placeholder="Telephone number"
            value={props.value?.PhoneNumberText}
            onChange={(newValue) => {
              props.onChange?.({
                ...props.value,
                PhoneNumberText:
                  newValue == null || /^\d{0,16}$/.test(newValue)
                    ? newValue
                    : props.value?.PhoneNumberText,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
