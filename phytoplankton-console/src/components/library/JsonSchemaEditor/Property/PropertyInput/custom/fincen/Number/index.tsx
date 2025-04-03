import React, { useCallback, useEffect, useState } from 'react';
import { padStart } from 'lodash';
import { ExtendedSchema, UiSchemaFincenNumber } from '../../../../../types';
import { InputProps } from '@/components/library/Form';
import TextInput from '@/components/library/TextInput';

interface Props extends InputProps<number> {
  uiSchema?: UiSchemaFincenNumber;
  schema: ExtendedSchema;
}

export default function FincenNumber(props: Props) {
  const { schema, onChange, value } = props;

  const uiSchema = schema['ui:schema'] ?? {};

  const maxDigits = uiSchema['ui:maxDigits'];
  const zeroPadLeft = uiSchema['ui:zeroPadLeft'];
  const allowNegative = uiSchema['ui:allowNegatives'] ?? true;

  const prepareDisplayString = useCallback(
    (number: number | undefined): string => {
      if (number == null) {
        return '';
      }
      let result = `${number}`;
      if (maxDigits != null) {
        result = result.substring(0, maxDigits);
        if (zeroPadLeft) {
          result = padStart(`${number}`, maxDigits, '0');
        }
      }
      return result;
    },
    [maxDigits, zeroPadLeft],
  );

  useEffect(() => {
    setLocalValue(prepareDisplayString(value));
  }, [value, prepareDisplayString]);

  const [localValue, setLocalValue] = useState<string | undefined>(
    prepareDisplayString(props.value),
  );

  return (
    <TextInput
      onFocus={() => {
        setLocalValue(prepareDisplayString(props.value));
      }}
      value={localValue}
      onChange={(newValue) => {
        if (newValue == null) {
          setLocalValue(newValue);
          return;
        }
        if (!/^-?\d*$/.test(newValue)) {
          return;
        }
        setLocalValue(maxDigits != null ? newValue.substring(0, maxDigits) : newValue);
      }}
      onBlur={() => {
        let newValue = localValue != null && localValue != '' ? parseInt(localValue) : undefined;
        const min = allowNegative ? schema.minimum : Math.max(0, schema.minimum ?? 0);
        const max = schema.maximum;
        if (newValue != null) {
          if (min != null) {
            newValue = Math.max(min, newValue);
          }
          if (max != null) {
            newValue = Math.min(max, newValue);
          }
        }
        onChange?.(newValue);
        setLocalValue(prepareDisplayString(newValue));
      }}
    />
  );
}
