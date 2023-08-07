import React from 'react';
import { UiSchemaFincenIndicator } from '../../../../../types';
import { InputProps } from '@/components/library/Form';
import Checkbox from '@/components/library/Checkbox';

interface Props extends InputProps<'Y'> {
  uiSchema?: UiSchemaFincenIndicator;
}

export default function Indicator(props: Props) {
  return (
    <Checkbox
      value={props.value === 'Y'}
      onChange={(newValue) => {
        props.onChange?.(newValue ? 'Y' : undefined);
      }}
    />
  );
}
