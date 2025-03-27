import React from 'react';
import { ExtendedSchema, UiSchemaFincenNumber } from '../../../../../types';
import { InputProps } from '@/components/library/Form';
import NumberInput from '@/components/library/NumberInput';

interface Props extends InputProps<number> {
  uiSchema?: UiSchemaFincenNumber;
  schema: ExtendedSchema;
}

export default function FincenNumber(props: Props) {
  const { schema, onChange } = props;
  const uiSchema = schema['ui:schema'] ?? {};

  const maxDigits = uiSchema['ui:maxDigits'];
  const allowNegative = uiSchema['ui:allowNegatives'] ?? true;

  return (
    <NumberInput
      step={1}
      min={allowNegative ? schema.minimum : Math.max(0, schema.minimum ?? 0)}
      max={schema.maximum}
      value={props.value}
      onChange={(value: number | undefined) => {
        if (onChange == null) {
          return;
        }
        if (value == null) {
          onChange(value);
          return;
        }

        const intValue = Math.floor(value);
        if (maxDigits != null) {
          onChange(Number(`${Math.floor(value)}`.substring(0, maxDigits)));
        } else {
          onChange(Math.floor(intValue));
        }
      }}
    />
  );
}
