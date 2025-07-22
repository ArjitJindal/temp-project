import React from 'react';
import { ExtendedSchema, UiSchemaFreeTextEnum } from '../../../../types';
import { InputProps } from '@/components/library/Form';
import Select from '@/components/library/Select';

interface Props extends InputProps<any> {
  uiSchema: UiSchemaFreeTextEnum;
  schema: ExtendedSchema;
}

export default function FreeTextEnumInput(props: Props) {
  const items = props.schema.items?.enum;
  const options = items?.map((item) => ({
    value: item,
    label: item,
  }));

  return <Select mode="TAGS" options={options ?? []} portaled placeholder="Select" {...props} />;
}
