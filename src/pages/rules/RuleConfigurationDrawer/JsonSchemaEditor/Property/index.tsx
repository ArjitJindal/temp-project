import React from 'react';
import { PropertyItem } from '../types';
import PropertyInput from './PropertyInput';
import { Props as LabelProps } from '@/components/library/Label';
import InputField from '@/components/library/Form/InputField';

interface Props {
  item: PropertyItem;
  labelProps?: Partial<LabelProps>;
}

export default function Property(props: Props) {
  const { item, labelProps } = props;
  const { schema, name } = item;

  let labelElement: 'div' | 'label' = 'div';
  switch (schema.type) {
    case 'boolean':
    case 'number':
    case 'integer':
    case 'string':
      labelElement = 'label';
      break;
  }

  let labelPosition: 'TOP' | 'RIGHT' = 'TOP';
  switch (schema.type) {
    case 'boolean':
      labelPosition = 'RIGHT';
      break;
  }

  return (
    <InputField<any>
      name={name}
      label={String(schema.title ?? name)}
      description={schema.description}
      labelProps={{
        element: labelElement,
        position: labelPosition,
        isOptional: !item.isRequired,
        ...labelProps,
      }}
    >
      {(inputProps) => <PropertyInput {...inputProps} schema={schema} />}
    </InputField>
  );
}
