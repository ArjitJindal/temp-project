import React from 'react';
import { UiSchemaUserType } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import { InternalBusinessUserTypeEnum, InternalConsumerUserTypeEnum } from '@/apis';
import SelectionGroup from '@/components/library/SelectionGroup';

type ValueType = InternalBusinessUserTypeEnum | InternalConsumerUserTypeEnum | undefined;

interface Props extends InputProps<ValueType> {
  uiSchema: UiSchemaUserType;
}

export default function UserTypeInput(props: Props) {
  const { value, onChange, ...rest } = props;
  return (
    <SelectionGroup
      mode={'SINGLE'}
      value={value == null ? 'ALL' : value}
      options={[
        { label: 'All', value: 'ALL' },
        { label: 'Consumer', value: 'CONSUMER' },
        { label: 'Business', value: 'BUSINESS' },
      ]}
      onChange={(newValue) => {
        let userType: ValueType = undefined;
        if (newValue === 'CONSUMER' || newValue === 'BUSINESS') {
          userType = newValue;
        }
        onChange?.(userType);
      }}
      {...rest}
    />
  );
}
