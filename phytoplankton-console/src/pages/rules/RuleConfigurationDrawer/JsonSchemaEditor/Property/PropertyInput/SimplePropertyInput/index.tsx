import React from 'react';
import { ExtendedSchema } from '../../../types';
import TextInput from '@/components/library/TextInput';
import NumberInput from '@/components/library/NumberInput';
import Checkbox from '@/components/library/Checkbox';
import Select from '@/components/library/Select';
import { InputProps } from '@/components/library/Form';
import { getUiSchema } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/utils';

// todo: fix any
interface Props extends InputProps<any> {
  schema: ExtendedSchema;
}

export default function SimplePropertyInput(props: Props) {
  const { schema, ...inputProps } = props;
  const uiSchema = getUiSchema(schema);
  switch (schema.type) {
    case 'string':
      if (schema.enum != null) {
        return (
          <Select
            {...inputProps}
            mode="SINGLE"
            placeholder={`Select ${uiSchema['ui:entityName'] ?? 'option'}`}
            options={(schema.enum ?? [])
              .filter((x): x is string => typeof x === 'string')
              .map((item) => ({ value: item, label: item }))}
          />
        );
      }
      return <TextInput placeholder="Enter text" {...inputProps} />;
    case 'boolean':
      return <Checkbox {...inputProps} value={inputProps.value ?? false} />;
    case 'number':
    case 'integer':
      return (
        <NumberInput
          placeholder="Enter number"
          {...inputProps}
          min={schema.minimum}
          max={schema.maximum}
        />
      );
    case 'array':
    case 'null':
    case 'any':
  }

  console.error(`Schema type "${schema.type}" is not supported`);

  return <></>;
}
